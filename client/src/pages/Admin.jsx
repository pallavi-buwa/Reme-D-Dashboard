import { useState, useEffect } from 'react'
import { adminApi } from '../api'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import { useNavigate } from 'react-router-dom'

const ROLES = ['admin', 'technical_specialist', 'account_manager', 'viewer']
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const PRIORITY_COLORS = { P0: 'bg-black text-white', P1: 'bg-red-600 text-white', P2: 'bg-orange-100 text-orange-800', P3: 'bg-blue-100 text-blue-700' }

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded transition-colors ${active ? 'bg-remed-red text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  )
}

// ─── Users ─────────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null) // null | 'create' | user object
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', region: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { adminApi.getUsers().then(r => setUsers(r.data)) }, [])

  function openCreate() { setForm({ name: '', email: '', password: '', role: 'viewer', region: '' }); setModal('create'); setError('') }
  function openEdit(u) { setForm({ name: u.name, email: u.email, password: '', role: u.role, region: u.region || '' }); setModal(u); setError('') }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        await adminApi.createUser(form)
      } else {
        const updates = { name: form.name, role: form.role, region: form.region }
        if (form.password) updates.password = form.password
        await adminApi.updateUser(modal.id, updates)
      }
      const { data } = await adminApi.getUsers(); setUsers(data)
      setModal(null)
    } catch (e) { setError(e.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this user?')) return
    await adminApi.deleteUser(id)
    const { data } = await adminApi.getUsers(); setUsers(data)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{users.length} users</p>
        <button onClick={openCreate} className="btn-primary text-sm">+ Add User</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Email', 'Role', 'Region', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{u.role}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.region || '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(u)} className="btn-ghost text-xs mr-1">Edit</button>
                  {u.active && <button onClick={() => handleDeactivate(u.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'Add User' : `Edit ${modal.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            {['name', 'email'].map(f => (
              <div key={f}>
                <label className="label capitalize">{f}</label>
                <input type={f === 'email' ? 'email' : 'text'} className="input" value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="label">Password {modal !== 'create' && <span className="text-gray-400 font-normal">(leave blank to keep)</span>}</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={modal !== 'create' ? 'unchanged' : ''} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Region (optional)</label>
              <input type="text" className="input" value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder="e.g. Egypt" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Priority Rules ───────────────────────────────────────────────────────────
function PriorityRulesTab() {
  const [rules, setRules] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', conditions: '', result_priority: 'P2', reasoning: '', order_index: 100, active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { adminApi.getPriorityRules().then(r => setRules(r.data)) }, [])

  const defaultConditions = JSON.stringify({ operator: 'AND', conditions: [{ field: 'field_id', op: 'eq', value: 'value' }] }, null, 2)

  function openCreate() { setForm({ name: '', conditions: defaultConditions, result_priority: 'P2', reasoning: '', order_index: 100, active: true }); setModal('create'); setError('') }
  function openEdit(r) { setForm({ name: r.name, conditions: JSON.stringify(JSON.parse(r.conditions), null, 2), result_priority: r.result_priority, reasoning: r.reasoning || '', order_index: r.order_index, active: !!r.active }); setModal(r); setError('') }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      JSON.parse(form.conditions)
      const payload = { ...form, conditions: form.conditions, active: form.active ? 1 : 0 }
      if (modal === 'create') await adminApi.createPriorityRule(payload)
      else await adminApi.updatePriorityRule(modal.id, payload)
      const { data } = await adminApi.getPriorityRules(); setRules(data)
      setModal(null)
    } catch (e) {
      setError(e.response?.data?.error || (e instanceof SyntaxError ? 'Invalid JSON in conditions' : 'Error'))
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this rule?')) return
    await adminApi.deletePriorityRule(id)
    const { data } = await adminApi.getPriorityRules(); setRules(data)
  }

  async function toggleActive(rule) {
    await adminApi.updatePriorityRule(rule.id, { active: rule.active ? 0 : 1 })
    const { data } = await adminApi.getPriorityRules(); setRules(data)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{rules.length} rules · evaluated in order</p>
        <button onClick={openCreate} className="btn-primary text-sm">+ Add Rule</button>
      </div>

      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.id} className={`card p-4 flex flex-wrap gap-3 items-center ${!r.active ? 'opacity-50' : ''}`}>
            <span className="text-xs text-gray-400 font-mono w-8">#{r.order_index}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_COLORS[r.result_priority] || ''}`}>{r.result_priority}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-800">{r.name}</div>
              {r.reasoning && <div className="text-xs text-gray-400 truncate">{r.reasoning}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(r)} className={`text-xs px-2 py-0.5 rounded-full border ${r.active ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400'}`}>
                {r.active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => openEdit(r)} className="btn-ghost text-xs">Edit</button>
              <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'New Priority Rule' : `Edit: ${modal.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="label">Rule Name</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <label className="label">Result Priority</label>
              <select className="input" value={form.result_priority} onChange={e => setForm(p => ({ ...p, result_priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Order Index (lower = evaluated first)</label><input type="number" className="input" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: +e.target.value }))} /></div>
            <div>
              <label className="label">Conditions (JSON)</label>
              <textarea rows={8} className="input font-mono text-xs resize-none" value={form.conditions} onChange={e => setForm(p => ({ ...p, conditions: e.target.value }))} />
              <p className="text-xs text-gray-400 mt-1">ops: <code>eq neq contains in truthy</code> · operator: <code>AND OR</code></p>
            </div>
            <div><label className="label">Reasoning (shown in complaint)</label><textarea rows={2} className="input resize-none" value={form.reasoning} onChange={e => setForm(p => ({ ...p, reasoning: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="active" className="text-sm text-gray-700">Active</label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Routing Rules ────────────────────────────────────────────────────────────
function RoutingRulesTab() {
  const [rules, setRules] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', conditions: '', assign_team: '', assign_role: '', escalate: false, order_index: 100, active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { adminApi.getRoutingRules().then(r => setRules(r.data)) }, [])

  const defaultConditions = JSON.stringify({ operator: 'AND', conditions: [{ field: 'category', op: 'eq', value: 'Device Failure' }] }, null, 2)

  function openCreate() { setForm({ name: '', conditions: defaultConditions, assign_team: '', assign_role: '', escalate: false, order_index: 100, active: true }); setModal('create'); setError('') }
  function openEdit(r) { setForm({ name: r.name, conditions: JSON.stringify(JSON.parse(r.conditions), null, 2), assign_team: r.assign_team || '', assign_role: r.assign_role || '', escalate: !!r.escalate, order_index: r.order_index, active: !!r.active }); setModal(r); setError('') }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      JSON.parse(form.conditions)
      const payload = { ...form, escalate: form.escalate ? 1 : 0, active: form.active ? 1 : 0 }
      if (modal === 'create') await adminApi.createRoutingRule(payload)
      else await adminApi.updateRoutingRule(modal.id, payload)
      const { data } = await adminApi.getRoutingRules(); setRules(data)
      setModal(null)
    } catch (e) {
      setError(e.response?.data?.error || (e instanceof SyntaxError ? 'Invalid JSON in conditions' : 'Error'))
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this rule?')) return
    await adminApi.deleteRoutingRule(id)
    const { data } = await adminApi.getRoutingRules(); setRules(data)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{rules.length} routing rules</p>
        <button onClick={openCreate} className="btn-primary text-sm">+ Add Rule</button>
      </div>

      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.id} className={`card p-4 flex flex-wrap gap-3 items-center ${!r.active ? 'opacity-50' : ''}`}>
            <span className="text-xs text-gray-400 font-mono w-8">#{r.order_index}</span>
            {r.escalate ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">🔺 Escalate</span> : null}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-800">{r.name}</div>
              <div className="text-xs text-gray-400">{r.assign_team ? `→ ${r.assign_team}` : ''} {r.assign_role ? `(${r.assign_role})` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${r.active ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400'}`}>{r.active ? 'Active' : 'Inactive'}</span>
              <button onClick={() => openEdit(r)} className="btn-ghost text-xs">Edit</button>
              <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal === 'create' ? 'New Routing Rule' : `Edit: ${modal.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="label">Rule Name</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">Assign Team</label><input className="input" value={form.assign_team} onChange={e => setForm(p => ({ ...p, assign_team: e.target.value }))} placeholder="Technical Engineering" /></div>
            <div>
              <label className="label">Assign Role</label>
              <select className="input" value={form.assign_role} onChange={e => setForm(p => ({ ...p, assign_role: e.target.value }))}>
                <option value="">— None —</option>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">Order Index</label><input type="number" className="input" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: +e.target.value }))} /></div>
            <div>
              <label className="label">Conditions (JSON)</label>
              <textarea rows={6} className="input font-mono text-xs resize-none" value={form.conditions} onChange={e => setForm(p => ({ ...p, conditions: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.escalate} onChange={e => setForm(p => ({ ...p, escalate: e.target.checked }))} />
                Triggers escalation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                Active
              </label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')

  if (user?.role !== 'admin') {
    navigate('/dashboard')
    return null
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, priority rules, and routing configuration</p>
      </div>

      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        <Tab active={tab === 'users'} onClick={() => setTab('users')}>Users</Tab>
        <Tab active={tab === 'priority'} onClick={() => setTab('priority')}>Priority Rules</Tab>
        <Tab active={tab === 'routing'} onClick={() => setTab('routing')}>Routing Rules</Tab>
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'priority' && <PriorityRulesTab />}
      {tab === 'routing' && <RoutingRulesTab />}
    </Layout>
  )
}
