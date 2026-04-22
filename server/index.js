const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const schemaRoutes = require('./routes/schema');
const complaintsRoutes = require('./routes/complaints');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3001;

initDatabase();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n  Reme-D API server running on http://localhost:${PORT}`);
  console.log(`\n  Default logins:`);
  console.log(`    admin@remed.com       / Admin@123   (Admin)`);
  console.log(`    specialist@remed.com  / Spec@123    (Technical Specialist)`);
  console.log(`    manager@remed.com     / Manager@123 (Account Manager)`);
  console.log(`    viewer@remed.com      / View@123    (Viewer)\n`);
});
