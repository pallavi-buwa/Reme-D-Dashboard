import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { complaintsApi, adminApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Layout from '../components/Layout'
import { StatusBadge, PriorityBadge } from '../components/StatusBadge'

const STATUSES = ['New', 'Triaged', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed']

function SectionCard({ name, data }) {
  const entries = Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  if (!entries.length) return null
  return (
    <div className="card p-4 mb-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{name}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {entries.map(([key, val]) => (
          <div key={key}>
            <dt className="text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</dt>
            <dd className="text-sm font-medium text-gray-800 mt-0.5">
              {Array.isArray(val) ? val.join(', ') : String(val)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function SignalPill({ label, active }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-red-500' : 'bg-gray-300'}`} />
      {label.replace(/_/g, ' ')}
    </span>
  )
}

function SlaRow({ label, data, t }) {
  const statusConfig = {
    met:      { cls: 'bg-green-100 text-green-700',  text: t('slaMet') },
    ok:       { cls: 'bg-blue-50 text-blue-600',     text: t('slaOk') },
    breached: { cls: 'bg-orange-100 text-orange-700', text: t('slaBreached') },
  }
  const sc = statusConfig[data.status] || statusConfig.ok
  const remainingText = data.status === 'met' ? null
    : data.remaining_mins < 0 ? t('slaOverdue', data.remaining_mins)
    : t('slaRemaining', data.remaining_mins)

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex-1 min-w-0">
        <span className="text-gray-500 font-medium">{label}</span>
        <span className="text-gray-300 mx-1">·</span>
        <span className="text-gray-400">{data.target_hours}{t('slaHours')} {t('slaTarget')}</span>
        {remainingText && <div className="text-gray-400 mt-0.5 truncate">{remainingText}</div>}
      </div>
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${sc.cls}`}>{sc.text}</span>
    </div>
  )
}

function SlaCard({ sla, t }) {
  const breached = sla.breached
  return (
    <div className={`card p-4 ${breached ? 'border-l-4 border-orange-400' : ''}`}>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        {t('slaStatus')}
        {breached && <span className="text-xs font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">⏱ {t('slaBreached')}</span>}
      </h4>
      <div className="space-y-3">
        <SlaRow label={t('slaResponseLabel')} data={sla.response} t={t} />
        <div className="border-t border-gray-100" />
        <SlaRow label={t('slaResolutionLabel')} data={sla.resolution} t={t} />
      </div>
    </div>
  )
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusChange, setStatusChange] = useState('')
  const [assignTo, setAssignTo] = useState('')

  const canUpdateStatus = ['admin', 'manager', 'technical_specialist'].includes(user?.role)
  const canAssign       = ['admin', 'manager'].includes(user?.role)
  const canEdit         = canUpdateStatus

  useEffect(() => {
    fetchComplaint()
    if (canAssign) adminApi.getUsers().then(r => setUsers(r.data)).catch(() => {})
  }, [id])

  async function fetchComplaint() {
    setLoading(true)
    try {
      const { data } = await complaintsApi.get(id)
      setComplaint(data)
      setStatusChange(data.status)
      setAssignTo(data.assigned_to || '')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate() {
    setSaving(true)
    try {
      const updates = {}
      if (statusChange !== complaint.status) updates.status = statusChange
      if (assignTo !== (complaint.assigned_to || '')) updates.assigned_to = assignTo
      if (Object.keys(updates).length) await complaintsApi.update(complaint.id, updates)
      await fetchComplaint()
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!note.trim()) return
    setSaving(true)
    try {
      await complaintsApi.addNote(complaint.id, note)
      setNote('')
      await fetchComplaint()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-remed-red border-t-transparent" />
      </div>
    </Layout>
  )
  if (!complaint) return <Layout><div className="text-center py-16 text-gray-400">{t('complaintNotFound')}</div></Layout>

  const trueSignals = Object.entries(complaint.signals || {}).filter(([, v]) => v === true)
  const falseSignals = Object.entries(complaint.signals || {}).filter(([, v]) => v === false)

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost text-sm">{t('back')}</button>
        <div className="flex-1" />
        <PriorityBadge priority={complaint.priority} />
        <StatusBadge status={complaint.status} />
        {complaint.escalated ? <span className="text-xs text-red-600 font-medium">{t('escalatedBadge')}</span> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="card p-5">
            <div className="flex flex-wrap gap-4 items-start justify-between mb-4">
              <div>
                <div className="font-mono text-lg font-bold text-gray-900">{complaint.ticket_id}</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {t('submittedBy')} <strong>{complaint.submitted_by_name}</strong> · {complaint.submitted_by_contact}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(complaint.created_at).toLocaleString()} · {complaint.lab_type} {complaint.region ? `· ${complaint.region}` : ''}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-xs text-gray-400 block">{t('labelCategory')}</span><strong>{complaint.category || '—'}</strong></div>
              <div><span className="text-xs text-gray-400 block">{t('labelDevice')}</span><strong>{complaint.device || '—'}</strong></div>
              <div><span className="text-xs text-gray-400 block">{t('labelTeam')}</span><strong>{complaint.assigned_team || '—'}</strong></div>
              <div><span className="text-xs text-gray-400 block">{t('labelAssignedTo')}</span><strong>{complaint.assigned_name || t('unassigned')}</strong></div>
            </div>
          </div>

          {/* Priority reasoning */}
          <div className="card p-4 border-l-4 border-remed-red">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t('priorityReasoningTitle')} · {complaint.priority}</div>
            <p className="text-sm text-gray-700">{complaint.priority_reasoning}</p>
            {complaint.priority_rule_name && (
              <p className="text-xs text-gray-400 mt-1">{t('ruleLabel')} <em>{complaint.priority_rule_name}</em></p>
            )}
          </div>

          {/* Derived signals */}
          {Object.keys(complaint.signals || {}).length > 0 && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('derivedSignals')}</h4>
              <div className="flex flex-wrap gap-1.5">
                {trueSignals.map(([k]) => <SignalPill key={k} label={k} active={true} />)}
                {falseSignals.map(([k]) => <SignalPill key={k} label={k} active={false} />)}
              </div>
            </div>
          )}

          {/* Section responses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('submittedFormData')}</h3>
            {complaint.sections?.map(s => (
              <SectionCard key={s.name} name={s.name} data={s.data} />
            ))}
          </div>

          {/* Attachments */}
          {complaint.attachments?.length > 0 && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('attachments')}</h4>
              {complaint.attachments.map(a => (
                <a key={a.id} href={`/uploads/${a.filename}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-remed-red hover:underline">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  {a.original_name}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: actions + history */}
        <div className="space-y-4">
          {/* Actions */}
          {canUpdateStatus && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('updateComplaint')}</h4>
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">{t('labelStatus')}</label>
                  <select className="input text-sm" value={statusChange} onChange={e => setStatusChange(e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                {canAssign && (
                  <div>
                    <label className="label text-xs">{t('labelAssignTo')}</label>
                    <select className="input text-sm" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                      <option value="">{t('unassignedOption')}</option>
                      {users.filter(u => ['manager','technical_specialist'].includes(u.role)).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button onClick={handleUpdate} disabled={saving} className="btn-primary w-full text-sm">
                  {saving ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </div>
          )}

          {/* SLA Status */}
          {complaint.sla && (
            <SlaCard sla={complaint.sla} t={t} />
          )}

          {/* Notes */}
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('internalNotes')}</h4>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {complaint.notes?.length === 0 && <p className="text-xs text-gray-400">{t('noNotes')}</p>}
              {complaint.notes?.map(n => (
                <div key={n.id} className="bg-gray-50 rounded p-2.5">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="font-medium text-gray-600">{n.user_name}</span>
                    <span>{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{n.note}</p>
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="space-y-2">
                <textarea rows={2} className="input text-sm resize-none" placeholder={t('addNotePlaceholder')} value={note} onChange={e => setNote(e.target.value)} />
                <button onClick={handleAddNote} disabled={saving || !note.trim()} className="btn-primary w-full text-sm">{t('addNote')}</button>
              </div>
            )}
          </div>

          {/* Status history */}
          <div className="card p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('statusHistory')}</h4>
            <div className="space-y-2">
              {complaint.status_history?.map(h => (
                <div key={h.id} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-remed-blue-grey mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-700">
                      {h.from_status ? `${h.from_status} → ` : ''}<strong>{h.to_status}</strong>
                    </span>
                    <span className="text-gray-400 ml-1">{t('by')} {h.changed_by}</span>
                    {h.notes && <p className="text-gray-400 mt-0.5">{h.notes}</p>}
                    <p className="text-gray-300">{new Date(h.changed_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment history */}
          {complaint.assignment_history?.length > 0 && (
            <div className="card p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('assignmentHistory')}</h4>
              <div className="space-y-2">
                {complaint.assignment_history.map(h => (
                  <div key={h.id} className="text-xs text-gray-600">
                    <span>{h.assigned_to || t('unassigned')}</span>
                    <span className="text-gray-400 ml-1">{t('by')} {h.assigned_by}</span>
                    <p className="text-gray-300">{new Date(h.assigned_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
