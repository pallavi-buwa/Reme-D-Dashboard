# Reme-D Diagnostic Workflow System

A structured diagnostic complaint management platform for Reme-D laboratory equipment support teams. Replaces manual ticketing with a schema-driven intake form, automatic prioritisation engine, team-based routing, SLA tracking, and a full internal staff dashboard.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles](#2-user-roles)
3. [Key Features](#3-key-features)
4. [Architecture](#4-architecture)
5. [Local Development Setup](#5-local-development-setup)
6. [Production Deployment Guide](#6-production-deployment-guide)
7. [Cost Analysis](#7-cost-analysis)
8. [Security](#8-security)
9. [Maintenance & Updates](#9-maintenance--updates)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. System Overview

The Reme-D Diagnostic Workflow System has two sides:

- **Public complaint form** — Customers and lab staff submit issues with their Reme-D equipment. No login required. Available at the root URL (`/`).
- **Staff dashboard** — Internal team members log in to view, triage, assign, and resolve complaints. Available at `/login`.

Once a complaint is submitted, the system automatically:
1. Assigns a unique ticket ID (e.g. `RMD-2025-0042`)
2. Evaluates the priority level (P0 critical → P3 minor) using configurable rules
3. Routes the complaint to the correct team (Technical Team or Sales Team)
4. Assigns an initial team member
5. Starts the SLA clock and escalates automatically if deadlines are missed

The system supports **Arabic and English** language switching throughout.

---

## 2. User Roles

| Role | What They Can Do |
|------|-----------------|
| **Admin** | Full access — manage users, teams, all complaints, priority rules, routing rules, SLA settings, analytics |
| **Manager** | View and manage all complaints assigned to their team; assign specialists within their team; add notes |
| **Technical Specialist** | View complaints assigned to their team; update complaint status; add internal notes |
| **Viewer** | Read-only access to all complaints — no edits |

### Teams
The system ships with two pre-configured teams:
- **Technical Team** — handles equipment failures, kit/reagent issues, assay/protocol issues, and environmental issues (Categories A, B, C, D)
- **Sales Team** — handles general and other category enquiries

Each team has one manager and multiple specialists. Teams, members, and roles are fully manageable from the Admin panel.

---

## 3. Key Features

### Dynamic Complaint Form
The entire multi-step intake form (8 sections, ~40 fields) is generated from a single configuration file (`server/schema.json`). No fields are hardcoded in the UI. Conditional fields appear and disappear automatically based on previous answers (e.g. blood type appears only when blood is the sample type).

**Form sections:**
1. Reporter & Laboratory Information
2. Sample & Extraction
3. Issue Description
4. Issue Categorisation & Severity
5. Controls & Standards Assessment
6. Device & System Details
7. Reagent & Control Check
8. Extra Information (free text + file attachment)

### Priority Engine (P0–P3)
Rules are stored in the database — not hardcoded. Admins can add, edit, reorder, or deactivate rules at any time from the Admin panel.

| Priority | Meaning | Default SLA |
|----------|---------|-------------|
| **P0** | Critical — immediate patient care risk | 2h response / 8h resolution |
| **P1** | High — system down or systemic failure | 4h response / 24h resolution |
| **P2** | Medium — partial failure or improper procedure | 24h response / 72h resolution |
| **P3** | Low — minor or single-sample issue | 72h response / 168h resolution |

### Routing Engine
Complaints are automatically assigned to a team based on the issue category selected in the form. All routing rules are configurable in the Admin panel.

### SLA & Auto-Escalation
Each complaint has a live SLA clock visible on the complaint detail page. If the resolution deadline is missed, the complaint is automatically escalated to **Escalated** status and reassigned to the team manager — no manual intervention needed.

### Complaint Lifecycle
```
New → Triaged → Assigned → In Progress → Escalated → Resolved → Closed
```
Full status history and assignment history are tracked with timestamps and the name of who made each change.

### Team-Based Visibility
- Managers and specialists only see complaints assigned to their own team
- Admins and Viewers see all complaints across all teams

### Analytics Dashboard
Charts and metrics showing complaint volume by priority, status, category, device, lab type, and a 30-day trend line.

### CSV Export
Admins can export all complaints to a CSV file from the dashboard.

---

## 4. Architecture

```
/
├── server/                    Node.js + Express API (port 3001)
│   ├── index.js               App entry point, middleware, production static serving
│   ├── database.js            SQLite setup, seed data, bulk data generator
│   ├── schema.json            Single source of truth for the complaint form structure
│   ├── data/
│   │   └── remed.db           SQLite database (auto-created on first run)
│   ├── uploads/               Uploaded complaint attachments
│   ├── engines/
│   │   ├── priority.js        Rule-based priority evaluator
│   │   ├── routing.js         Team routing engine
│   │   ├── signals.js         Diagnostic signal extractor
│   │   └── sla.js             SLA computation and breach detection
│   ├── middleware/
│   │   └── auth.js            JWT authentication + role-based access guards
│   └── routes/
│       ├── auth.js            Login, session validation
│       ├── schema.js          Form schema endpoint
│       ├── complaints.js      Submit, list, detail, update, notes, CSV export
│       ├── admin.js           Users, teams, priority rules, routing rules, SLA config
│       └── analytics.js      Aggregated stats for charts
│
└── client/                    React 18 + Vite + Tailwind CSS
    └── src/
        ├── api/index.js       Axios client with JWT interceptor
        ├── context/
        │   ├── AuthContext     JWT login state management
        │   └── LanguageContext Arabic/English toggle
        ├── components/
        │   ├── form/
        │   │   ├── FormWizard.jsx    Multi-step form controller
        │   │   ├── FormStep.jsx      Per-section field renderer
        │   │   └── fields/           Text, Radio, Dropdown, Checkbox, DateTime, File
        │   ├── Layout.jsx            Staff layout with nav bar
        │   ├── StatusBadge.jsx       Priority and status badge components
        │   └── LanguageToggle.jsx    AR/EN switcher
        └── pages/
            ├── SubmitComplaint.jsx   Public form (no login required)
            ├── Login.jsx             Staff login page
            ├── Dashboard.jsx         Complaint list with filters, views, pagination
            ├── ComplaintDetail.jsx   Full detail, status update, notes, history, SLA
            ├── Analytics.jsx         Charts and metrics
            └── Admin.jsx             User/team management, rules editor, SLA config
```

**Technology choices:**
- **`node:sqlite`** — SQLite built into Node.js 22+ (no separate database server needed, no native compilation issues)
- **JWT** — Tokens stored in browser localStorage, expire after 24 hours
- **bcrypt** — All passwords hashed with cost factor 12
- **Helmet.js** — Security HTTP headers on every response
- **multer** — File attachment handling (max 20 MB per file)

---

## 5. Local Development Setup

> This section is for developers working on the codebase. Skip to Section 6 for deployment.

### Prerequisites
- Node.js 22.5 or later
- npm

### Setup

```bash
# Install all dependencies (server + client)
npm run setup

# Start both servers in development mode
npm run dev
```

- **Public complaint form:** http://localhost:5173
- **Staff login:** http://localhost:5173/login
- **API:** http://localhost:3001/api

### Modifying the Form Schema
Edit `server/schema.json`. The form UI updates automatically — no code changes needed. Each field supports: `type` (text, email, tel, radio, dropdown, checkbox, datetime, textarea, file), `label`, `required`, `options` (for radio/dropdown/checkbox), and `condition` (for conditional visibility).

### Modifying Priority or Routing Rules
Rules can be edited live in the Admin panel while the server is running. They can also be seeded directly in `server/database.js` in the `seedData()` function.

---

## 6. Production Deployment Guide

> **For Reme-D staff:** Follow these steps in order to get the system live on the internet. Each step includes the exact commands to type.

### What You Will Need to Purchase/Create First

| Item | Where | Cost |
|------|-------|------|
| Domain name (e.g. `portal.reme-d.com`) | namecheap.com | ~$12/year |
| DigitalOcean account + credit card | digitalocean.com | $6/month |

---

### Step 1 — Buy a Domain Name

1. Go to **[namecheap.com](https://namecheap.com)**
2. Search for a domain name (e.g. `remed-portal.com`)
3. Add to cart → Checkout → Create an account → Pay
4. **Write down your domain name** — you will need it later

---

### Step 2 — Create a Cloud Server

1. Go to **[digitalocean.com](https://digitalocean.com)** → Sign Up → verify your email → add your credit card
2. Click the green **Create** button → **Droplets**
3. Settings to choose:
   - **Region:** Closest to your users (Frankfurt for MENA, Singapore for Asia)
   - **Image:** Ubuntu → **24.04 (LTS) x64**
   - **Size:** Basic → Regular → **$6/month** (1 GB RAM)
   - **Authentication:** Password → enter a strong password and **write it down**
   - **Name:** `remed-server`
4. Click **Create Droplet** and wait ~60 seconds
5. **Write down the IP address** shown (e.g. `142.93.45.22`)

---

### Step 3 — Connect to Your Server

Open **Command Prompt** (Windows key + R → type `cmd` → Enter):

```
ssh root@YOUR_SERVER_IP
```

Type `yes` when asked, then enter your password. You will see a prompt like `root@remed-server:~#` — you are now connected.

---

### Step 4 — Install Required Software

Paste each command and wait for it to finish before pasting the next:

```bash
# Update the server
apt update && apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Confirm Node.js installed correctly (should show v22.x.x)
node --version

# Install Nginx (web gateway) and Git
apt install -y nginx git

# Install PM2 (keeps your app running 24/7)
npm install -g pm2
```

---

### Step 5 — Download and Build the Application

```bash
# Download the code
cd /var/www
git clone https://github.com/pallavi-buwa/Reme-D-Dashboard.git remed
cd remed
git checkout feature/newform

# Install server packages
cd /var/www/remed/server
npm install

# Install and build the frontend
cd /var/www/remed/client
npm install
npm run build
```

You should see `✓ built in X.Xs` at the end — this means the frontend was built successfully.

---

### Step 6 — Configure Security Settings

Generate a secret key (copy the long string it prints):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the configuration file:

```bash
nano /var/www/remed/server/.env
```

Type the following inside the file (replace `PASTE_KEY_HERE` with the key you just generated, and `YOUR_DOMAIN` with your actual domain):

```
NODE_ENV=production
PORT=3001
JWT_SECRET=PASTE_KEY_HERE
ALLOWED_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
```

Press **Ctrl + X** → **Y** → **Enter** to save.

Install the package that reads this file:

```bash
cd /var/www/remed/server
npm install dotenv
sed -i '1s/^/require("dotenv").config();\n/' index.js
```

---

### Step 7 — Start the Application

```bash
cd /var/www/remed/server
pm2 start index.js --name "remed"

# Verify it is running (should show "online")
pm2 status

# Save so it restarts automatically after a server reboot
pm2 startup
# → Copy and paste the command it gives you, then run:
pm2 save

# Quick health check
curl http://localhost:3001/api/health
# Should return: {"status":"ok","time":"..."}
```

---

### Step 8 — Set Up the Web Gateway (Nginx)

```bash
nano /etc/nginx/sites-available/remed
```

Paste the following (replace `YOUR_DOMAIN` with your domain name):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    client_max_body_size 25M;

    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Press **Ctrl + X** → **Y** → **Enter** to save.

```bash
ln -s /etc/nginx/sites-available/remed /etc/nginx/sites-enabled/
nginx -t
# Should say: syntax is ok / test is successful
systemctl reload nginx
```

---

### Step 9 — Point Your Domain to the Server

1. Log in to **Namecheap** → Domain List → **Manage** next to your domain
2. Click **Advanced DNS** tab
3. Delete any existing **A Record** rows
4. Add two new records:

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | Your server IP address |
| A Record | `www` | Your server IP address |

5. Save and wait **15–30 minutes**
6. Open a browser and go to `http://YOUR_DOMAIN` — the Reme-D login page should appear

---

### Step 10 — Enable HTTPS (Free SSL Certificate)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

When prompted:
- Enter your email address
- Type `Y` to agree to terms
- Type `N` for marketing emails
- Select **option 2** (Redirect all HTTP to HTTPS)

Your system is now live at `https://YOUR_DOMAIN` ✅

Verify auto-renewal works:
```bash
certbot renew --dry-run
# Should say: All simulated renewals succeeded
```

---

### Step 11 — Immediately After Going Live

1. Log in as the admin user
2. Go to **Admin → Users**
3. Change the admin password to something strong and private
4. Change the passwords for all team members
5. Verify that each team member can log in and sees only their team's complaints

---

### Step 12 — Set Up Daily Backups

```bash
mkdir -p /var/backups/remed
nano /usr/local/bin/backup-remed.sh
```

Paste:

```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
cp /var/www/remed/server/data/remed.db /var/backups/remed/remed-$DATE.db
find /var/backups/remed -name "*.db" -mtime +30 -delete
echo "Backup completed: remed-$DATE.db"
```

Press **Ctrl + X** → **Y** → **Enter**.

```bash
chmod +x /usr/local/bin/backup-remed.sh

# Schedule it to run every day at 2:00 AM
crontab -e
```

Select option **1** (nano editor). Add this line at the bottom of the file:

```
0 2 * * * /usr/local/bin/backup-remed.sh >> /var/log/remed-backup.log 2>&1
```

Press **Ctrl + X** → **Y** → **Enter** to save.

---

## 7. Cost Analysis

### One-Time Costs

| Item | Cost |
|------|------|
| Domain name (first year) | ~$12 |

### Monthly Costs

| Item | Cost/month | Notes |
|------|-----------|-------|
| DigitalOcean Droplet | $6 | Sufficient for everyday use by your team |
| SSL Certificate | $0 | Free via Let's Encrypt, renews automatically |
| **Total** | **$6/month** | |

### Annual Cost Summary

| Scenario | Year 1 | Year 2+ |
|----------|--------|---------|
| Basic (server + domain) | **~$84** | **~$72** |
| With off-server cloud backups | **~$144** | **~$132** |

> Off-server backups ($5/month via DigitalOcean Spaces) store your database on a completely separate system and are strongly recommended for a live production environment.

### When to Upgrade

The $6/month server handles normal day-to-day use comfortably. Consider upgrading to the $12/month plan if:
- More than 500 team members are using the system at the same time
- You are storing a very large number of file attachments

### Future Cost Considerations

| Item | Estimated Cost | When Needed |
|------|---------------|-------------|
| Email notifications | $15–35/month | If automated email alerts are added |
| Larger server | $12–18/month | If user numbers grow significantly |
| Domain renewal | ~$12/year | Every year after the first |
| Developer time for new features | Variable | As needed |

---

## 8. Security

The following security measures are active in this system:

| Measure | Details |
|---------|---------|
| **HTTPS** | All traffic encrypted with TLS (Let's Encrypt) |
| **JWT Authentication** | Staff session tokens expire after 24 hours |
| **Password Hashing** | All passwords stored as bcrypt hashes (cost factor 12) — passwords are never stored in plain text |
| **Security Headers** | Helmet.js applies X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, and others on every response |
| **Password Strength** | New passwords must be at least 8 characters with at least one uppercase letter and one number |
| **Role-Based Access** | Every API endpoint checks the user's role — staff can only access what their role permits |
| **Team Visibility** | Managers and specialists can only see complaints belonging to their own team |
| **Cross-Team Protection** | A manager cannot assign a complaint to a specialist from another team |
| **User Enumeration Prevention** | The login endpoint always takes the same amount of time whether or not an email exists |

### Important: Rotate Credentials on First Deploy

Immediately after deploying, log in as admin and change the passwords for all accounts. The initial passwords set during system setup should never be used in production.

### JWT Secret

The `JWT_SECRET` environment variable must be set to a long, random string in production (the setup steps above include generating one). If this is not set, the server will warn you on startup.

---

## 9. Maintenance & Updates

### Daily (Automated)
- Backups run at 2:00 AM automatically
- SSL certificate auto-renews (no action needed)
- SLA escalations happen automatically when complaints are opened

### Weekly (Recommended)
- Log in and review the Analytics page for any unusual patterns
- Check that backups are being created: `ls /var/backups/remed/`

### When a Code Update is Provided

SSH into the server and run:

```bash
cd /var/www/remed
git pull origin feature/newform
cd client && npm install && npm run build
cd ../server && npm install
pm2 restart remed
```

### Useful Day-to-Day Commands

| Task | Command |
|------|---------|
| Check if the app is running | `pm2 status` |
| Restart the app | `pm2 restart remed` |
| View live application logs | `pm2 logs remed` |
| Run a manual backup now | `/usr/local/bin/backup-remed.sh` |
| List saved backups | `ls /var/backups/remed/` |
| Restart web gateway | `systemctl reload nginx` |

---

## 10. Troubleshooting

### Site is not loading
1. SSH into the server
2. Run `pm2 status` — if the app shows **stopped**, run `pm2 restart remed`
3. Run `systemctl status nginx` — if Nginx is down, run `systemctl start nginx`

### "Invalid credentials" on login
- Ensure you are using the correct email and password
- Passwords are case-sensitive
- If you have forgotten the admin password, it can be reset by a developer directly in the database

### Data appears to be missing
- Check if the database file exists: `ls /var/www/remed/server/data/remed.db`
- If it is missing, restore from the most recent backup:
  ```bash
  cp /var/backups/remed/remed-YYYY-MM-DD.db /var/www/remed/server/data/remed.db
  pm2 restart remed
  ```
  Replace `YYYY-MM-DD` with the date of the backup you want to restore.

### File uploads not saving
- Check available disk space: `df -h`
- Check the uploads folder exists: `ls /var/www/remed/server/uploads/`

### SSL certificate error in browser
```bash
certbot renew --force-renewal
systemctl reload nginx
```

---

*System developed for Reme-D. For technical support and code changes, contact the development team.*
