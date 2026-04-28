import { useState, useEffect } from 'react'
import { adminApi, teamsApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Layout from '../components/Layout'
import { useNavigate } from 'react-router-dom'

const ROLES = ['admin', 'manager', 'technical_specialist', 'viewer']
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
  const { t } = useLanguage()
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null)
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
    } catch (e) { setError(e.response?.data?.error || t('errorGeneric')) } finally { setSaving(false) }
  }

  async function handleDeactivate(id) {
    if (!confirm(t('deactivateConfirm'))) return
    await adminApi.deleteUser(id)
    const { data } = await adminApi.getUsers(); setUsers(data)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{t('usersCount', users.filter(u => u.active).length)}</p>
        <button onClick={openCreate} className="btn-primary text-sm">{t('addUser')}</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[t('colName'), t('colEmail'), t('colRole'), t('colRegion'), ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.filter(u => u.active).map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{u.role}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.region || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(u)} className="btn-ghost text-xs mr-1">{t('btnEdit')}</button>
                  <button onClick={() => handleDeactivate(u.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">{t('btnDeactivate')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'create' ? t('modalAddUser') : t('modalEditUser', modal.name)} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="label capitalize">{t('labelName')}</label>
              <input type="text" className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('labelEmail')}</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">
                {t('labelPasswordOptional')}
                {modal !== 'create' && <span className="text-gray-400 font-normal"> {t('leaveBlank')}</span>}
              </label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={modal !== 'create' ? 'unchanged' : ''} />
            </div>
            <div>
              <label className="label">{t('labelRole')}</label>
              <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('labelRegionOptional')}</label>
              <input type="text" className="input" value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} placeholder={t('regionPlaceholder')} />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? t('saving') : t('btnSave')}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">{t('btnCancel')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Priority Rules ───────────────────────────────────────────────────────────
function PriorityRulesTab() {
  const { t } = useLanguage()
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
      setError(e.response?.data?.error || (e instanceof SyntaxError ? t('invalidJson') : t('errorGeneric')))
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm(t('deleteRuleConfirm'))) return
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
        <p className="text-sm text-gray-500">{t('priorityRulesCount', rules.length)}</p>
        <button onClick={openCreate} className="btn-primary text-sm">{t('addRule')}</button>
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
                {r.active ? t('statusActive') : t('statusInactive')}
              </button>
              <button onClick={() => openEdit(r)} className="btn-ghost text-xs">{t('btnEdit')}</button>
              <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">{t('btnDelete')}</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal === 'create' ? t('modalNewPriority') : `${t('modalEditPrefix')} ${modal.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="label">{t('labelRuleName')}</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <label className="label">{t('labelResultPriority')}</label>
              <select className="input" value={form.result_priority} onChange={e => setForm(p => ({ ...p, result_priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">{t('labelOrderIndex')}</label><input type="number" className="input" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: +e.target.value }))} /></div>
            <div>
              <label className="label">{t('labelConditionsJson')}</label>
              <textarea rows={8} className="input font-mono text-xs resize-none" value={form.conditions} onChange={e => setForm(p => ({ ...p, conditions: e.target.value }))} />
              <p className="text-xs text-gray-400 mt-1">{t('conditionsHint')}</p>
            </div>
            <div><label className="label">{t('labelReasoning')}</label><textarea rows={2} className="input resize-none" value={form.reasoning} onChange={e => setForm(p => ({ ...p, reasoning: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="active" className="text-sm text-gray-700">{t('labelActive')}</label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? t('saving') : t('btnSave')}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">{t('btnCancel')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Routing Rules ────────────────────────────────────────────────────────────
function RoutingRulesTab() {
  const { t } = useLanguage()
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
      setError(e.response?.data?.error || (e instanceof SyntaxError ? t('invalidJson') : t('errorGeneric')))
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm(t('deleteRuleConfirm'))) return
    await adminApi.deleteRoutingRule(id)
    const { data } = await adminApi.getRoutingRules(); setRules(data)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{t('routingRulesCount', rules.length)}</p>
        <button onClick={openCreate} className="btn-primary text-sm">{t('addRule')}</button>
      </div>

      <div className="space-y-2">
        {rules.map(r => (
          <div key={r.id} className={`card p-4 flex flex-wrap gap-3 items-center ${!r.active ? 'opacity-50' : ''}`}>
            <span className="text-xs text-gray-400 font-mono w-8">#{r.order_index}</span>
            {r.escalate ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">🔺 {t('viewEscalated')}</span> : null}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-800">{r.name}</div>
              <div className="text-xs text-gray-400">{r.assign_team ? `→ ${r.assign_team}` : ''} {r.assign_role ? `(${r.assign_role})` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${r.active ? 'border-green-300 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400'}`}>
                {r.active ? t('statusActive') : t('statusInactive')}
              </span>
              <button onClick={() => openEdit(r)} className="btn-ghost text-xs">{t('btnEdit')}</button>
              <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">{t('btnDelete')}</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal === 'create' ? t('modalNewRouting') : `${t('modalEditPrefix')} ${modal.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="label">{t('labelRuleName')}</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">{t('labelAssignTeam')}</label><input className="input" value={form.assign_team} onChange={e => setForm(p => ({ ...p, assign_team: e.target.value }))} placeholder="Technical Engineering" /></div>
            <div>
              <label className="label">{t('labelAssignRole')}</label>
              <select className="input" value={form.assign_role} onChange={e => setForm(p => ({ ...p, assign_role: e.target.value }))}>
                <option value="">{t('roleNone')}</option>
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">{t('labelOrderIndexShort')}</label><input type="number" className="input" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: +e.target.value }))} /></div>
            <div>
              <label className="label">{t('labelConditionsJson')}</label>
              <textarea rows={6} className="input font-mono text-xs resize-none" value={form.conditions} onChange={e => setForm(p => ({ ...p, conditions: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                {t('labelActive')}
              </label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? t('saving') : t('btnSave')}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">{t('btnCancel')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── SLA Configs ──────────────────────────────────────────────────────────────
const PRIORITY_LABELS = { P0: 'P0 · Critical', P1: 'P1 · High', P2: 'P2 · Medium', P3: 'P3 · Low' }

function SlaTab() {
  const { t } = useLanguage()
  const [configs, setConfigs] = useState([])
  const [modal, setModal] = useState(null) // sla_config row or null
  const [form, setForm] = useState({ response_hours: '', resolution_hours: '', active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { adminApi.getSlaConfigs().then(r => setConfigs(r.data)) }, [])

  function openEdit(cfg) {
    setForm({ response_hours: cfg.response_hours, resolution_hours: cfg.resolution_hours, active: !!cfg.active })
    setModal(cfg)
    setError('')
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const rh = parseFloat(form.response_hours)
      const resh = parseFloat(form.resolution_hours)
      if (!isFinite(rh) || rh <= 0 || !isFinite(resh) || resh <= 0) {
        setError('Hours must be positive numbers'); setSaving(false); return
      }
      await adminApi.updateSlaConfig(modal.priority, { response_hours: rh, resolution_hours: resh, active: form.active ? 1 : 0 })
      const { data } = await adminApi.getSlaConfigs(); setConfigs(data)
      setSaved(true)
      setTimeout(() => setModal(null), 800)
    } catch (e) { setError(e.response?.data?.error || t('errorGeneric')) } finally { setSaving(false) }
  }

  const slaStatusColor = (cfg) => cfg.active ? 'text-green-600' : 'text-gray-400'

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{t('slaSubtitle')}</p>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Priority', t('slaResponse'), t('slaResolution'), t('slaActive'), ''].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {configs.map(cfg => (
              <tr key={cfg.priority} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_COLORS[cfg.priority] || ''}`}>
                    {PRIORITY_LABELS[cfg.priority] || cfg.priority}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-base font-semibold text-gray-900">{cfg.response_hours}</span>
                  <span className="text-xs text-gray-400 ml-1">{t('slaHours')}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-base font-semibold text-gray-900">{cfg.resolution_hours}</span>
                  <span className="text-xs text-gray-400 ml-1">{t('slaHours')}</span>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-medium ${slaStatusColor(cfg)}`}>
                    {cfg.active ? t('statusActive') : t('statusInactive')}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => openEdit(cfg)} className="btn-ghost text-xs">{t('slaEdit')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={t('slaEditTitle', modal.priority)} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">{t('slaResponseHours')}</label>
              <input
                type="number" min="0.5" step="0.5" className="input"
                value={form.response_hours}
                onChange={e => setForm(p => ({ ...p, response_hours: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">{t('slaResponseHint')}</p>
            </div>
            <div>
              <label className="label">{t('slaResolutionHours')}</label>
              <input
                type="number" min="1" step="1" className="input"
                value={form.resolution_hours}
                onChange={e => setForm(p => ({ ...p, resolution_hours: e.target.value }))}
              />
              <p className="text-xs text-gray-400 mt-1">{t('slaResolutionHint')}</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sla_active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="sla_active" className="text-sm text-gray-700">{t('slaActive')}</label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {saved && <p className="text-green-600 text-sm">{t('slaSaveOk')}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? t('saving') : t('btnSave')}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">{t('btnCancel')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Teams Tab ────────────────────────────────────────────────────────────────
function TeamsTab() {
  const { t } = useLanguage()
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null) // null | 'create' | team-obj (rename) | {type:'addMember',team} | {type:'setManager',team}
  const [form, setForm] = useState({ name: '', managerId: '', memberIds: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const assignableUsers = users.filter(u => u.active && ['manager','technical_specialist'].includes(u.role))

  function reload() {
    Promise.all([teamsApi.getTeams(), adminApi.getUsers()]).then(([tr, ur]) => {
      setTeams(tr.data); setUsers(ur.data)
    })
  }
  useEffect(() => { reload() }, [])

  function openCreate() {
    setForm({ name: '', managerId: '', memberIds: [] })
    setModal('create'); setError('')
  }
  function openRename(team) {
    setForm({ name: team.name, managerId: '', memberIds: [] })
    setModal({ type: 'rename', team }); setError('')
  }

  async function handleCreate() {
    setSaving(true); setError('')
    try {
      const { data } = await teamsApi.createTeam({ name: form.name.trim() })
      const teamId = data.id
      // Assign manager
      if (form.managerId) await adminApi.updateUser(form.managerId, { team_id: teamId, role: 'manager' })
      // Assign members
      for (const uid of form.memberIds) {
        if (uid !== form.managerId) await adminApi.updateUser(uid, { team_id: teamId })
      }
      reload(); setModal(null)
    } catch (e) { setError(e.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  async function handleRename() {
    setSaving(true); setError('')
    try {
      await teamsApi.updateTeam(modal.team.id, { name: form.name.trim() })
      reload(); setModal(null)
    } catch (e) { setError(e.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this team? All members will be unassigned from it.')) return
    await teamsApi.deleteTeam(id); reload()
  }

  async function handleSetUser(userId, teamId, role) {
    await adminApi.updateUser(userId, { team_id: teamId || null, ...(role ? { role } : {}) })
    reload()
  }

  async function handleRemoveUser(userId) {
    await adminApi.updateUser(userId, { team_id: null }); reload()
  }

  const unassigned = assignableUsers.filter(u => !u.team_id)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{teams.length} team{teams.length !== 1 ? 's' : ''} · {unassigned.length} unassigned user{unassigned.length !== 1 ? 's' : ''}</p>
        <button onClick={openCreate} className="btn-primary text-sm">+ Create Team</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map(team => {
          // All users currently in this team (from the flat users list)
          const teamUsers = assignableUsers.filter(u => u.team_id === team.id)
          const teamManager = teamUsers.find(u => u.role === 'manager')
          const teamMembers = teamUsers.filter(u => u.role !== 'manager')
          // Candidates to add — everyone NOT already in this team
          const addCandidates = assignableUsers.filter(u => u.team_id !== team.id)

          return (
            <div key={team.id} className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 text-base">{team.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => openRename(team)} className="btn-ghost text-xs">Rename</button>
                  <button onClick={() => handleDelete(team.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1">Delete</button>
                </div>
              </div>

              {/* Manager */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Manager</p>
                {teamManager ? (
                  <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{teamManager.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{teamManager.email}</span>
                    </div>
                    <button onClick={() => handleRemoveUser(teamManager.id)} className="text-xs text-gray-300 hover:text-red-500 ml-2">✕</button>
                  </div>
                ) : (
                  <div className="border border-dashed border-gray-200 rounded-md px-3 py-2">
                    <select className="w-full text-xs text-gray-500 bg-transparent border-none outline-none" defaultValue="" onChange={e => { if (e.target.value) handleSetUser(e.target.value, team.id, 'manager') }}>
                      <option value="" disabled>Select a manager from existing users…</option>
                      {addCandidates.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}{u.team_id ? ` (in ${teams.find(t=>t.id===u.team_id)?.name || 'another team'})` : ''}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Members */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Specialists ({teamMembers.length})</p>
                <div className="space-y-1">
                  {teamMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-1.5">
                      <div>
                        <span className="text-sm text-gray-700">{m.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{m.email}</span>
                      </div>
                      <button onClick={() => handleRemoveUser(m.id)} className="text-xs text-gray-300 hover:text-red-500 ml-2">✕</button>
                    </div>
                  ))}
                  {/* Add member from any user in the system */}
                  {addCandidates.length > 0 && (
                    <div className="mt-1 border border-dashed border-gray-200 rounded-md px-3 py-1.5">
                      <select className="w-full text-xs text-gray-500 bg-transparent border-none outline-none" defaultValue="" onChange={e => { if (e.target.value) { handleSetUser(e.target.value, team.id, null); e.target.value='' } }}>
                        <option value="" disabled>+ Add member from existing users…</option>
                        {addCandidates.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role}){u.team_id ? ` — move from ${teams.find(t=>t.id===u.team_id)?.name || '?'}` : ''}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Unassigned users pool */}
      {unassigned.length > 0 && (
        <div className="mt-4 card p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Unassigned Users ({unassigned.length})</h4>
          <div className="space-y-2">
            {unassigned.map(u => (
              <div key={u.id} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-gray-700">{u.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{u.email}</span>
                  <span className="text-xs bg-gray-200 text-gray-500 rounded px-1.5 py-0.5 ml-2">{u.role}</span>
                </div>
                <select
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-remed-red"
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleSetUser(u.id, e.target.value, null) }}
                >
                  <option value="" disabled>Assign to team →</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {modal === 'create' && (
        <Modal title="Create New Team" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">Team Name <span className="text-remed-red">*</span></label>
              <input className="input" placeholder="e.g. Technical Team" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} autoFocus />
            </div>
            <div>
              <label className="label">Manager <span className="text-gray-400 font-normal text-xs">(optional — can assign later)</span></label>
              <select className="input" value={form.managerId} onChange={e => setForm(f => ({...f, managerId: e.target.value}))}>
                <option value="">— Select from existing users —</option>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}){u.team_id ? ` — currently in ${teams.find(t=>t.id===u.team_id)?.name || 'another team'}` : ''}
                  </option>
                ))}
              </select>
              {form.managerId && assignableUsers.find(u=>u.id===form.managerId)?.role !== 'manager' && (
                <p className="text-xs text-orange-500 mt-1">⚠ This user's role will be updated to <strong>manager</strong></p>
              )}
            </div>
            <div>
              <label className="label">Initial Members <span className="text-gray-400 font-normal text-xs">(optional — hold Ctrl/⌘ for multiple)</span></label>
              <select
                className="input h-28"
                multiple
                value={form.memberIds}
                onChange={e => setForm(f => ({...f, memberIds: Array.from(e.target.selectedOptions, o => o.value)}))}
              >
                {assignableUsers.filter(u => u.id !== form.managerId).map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}){u.team_id ? ` — ${teams.find(t=>t.id===u.team_id)?.name || 'another team'}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreate} disabled={saving || !form.name.trim()} className="btn-primary flex-1">{saving ? 'Creating…' : 'Create Team'}</button>
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rename Modal */}
      {modal?.type === 'rename' && (
        <Modal title={`Rename: ${modal.team.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="label">New Team Name</label><input className="input" value={form.name} onChange={e => setForm(f=>({...f, name: e.target.value}))} autoFocus /></div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={handleRename} disabled={saving || !form.name.trim()} className="btn-primary flex-1">{saving ? 'Saving…' : 'Rename'}</button>
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
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [tab, setTab] = useState('teams')

  if (user?.role !== 'admin') {
    navigate('/dashboard')
    return null
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('adminTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('adminSubtitle')}</p>
      </div>

      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        <Tab active={tab === 'teams'} onClick={() => setTab('teams')}>Teams</Tab>
        <Tab active={tab === 'users'} onClick={() => setTab('users')}>{t('tabUsers')}</Tab>
        <Tab active={tab === 'priority'} onClick={() => setTab('priority')}>{t('tabPriority')}</Tab>
        <Tab active={tab === 'routing'} onClick={() => setTab('routing')}>{t('tabRouting')}</Tab>
        <Tab active={tab === 'sla'} onClick={() => setTab('sla')}>{t('tabSla')}</Tab>
      </div>

      {tab === 'teams' && <TeamsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'priority' && <PriorityRulesTab />}
      {tab === 'routing' && <RoutingRulesTab />}
      {tab === 'sla' && <SlaTab />}
    </Layout>
  )
}
