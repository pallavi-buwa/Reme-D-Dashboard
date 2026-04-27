import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { complaintsApi, adminApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Layout from '../components/Layout'
import { StatusBadge, PriorityBadge } from '../components/StatusBadge'

const STATUSES   = ['New', 'Triaged', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed']
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const PAGE_SIZES = [10, 25, 50, 100]

// ── Pagination bar ─────────────────────────────────────────────────────────────
function PaginationBar({ total, page, pageSize, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  // Build page number array with ellipsis
  function pageNumbers() {
    const delta = 2
    const range = []
    for (let i = Math.max(2, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i)
    }
    const pages = []
    if (totalPages === 1) return [1]
    pages.push(1)
    if (range[0] > 2) pages.push('…')
    pages.push(...range)
    if (range[range.length - 1] < totalPages - 1) pages.push('…')
    if (totalPages > 1) pages.push(totalPages)
    return pages
  }

  const btnBase  = 'inline-flex items-center justify-center h-7 min-w-[28px] rounded text-xs font-medium transition-colors px-1.5'
  const btnNorm  = `${btnBase} text-gray-600 hover:bg-gray-100`
  const btnActive = `${btnBase} bg-remed-red text-white`
  const btnDis   = `${btnBase} text-gray-300 cursor-not-allowed`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white rounded-b-lg">
      {/* Left: result count */}
      <span className="text-xs text-gray-500">
        {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}
      </span>

      {/* Centre: page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className={page === 1 ? btnDis : btnNorm}
        >
          ←
        </button>

        {pageNumbers().map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="text-xs text-gray-400 px-1">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={p === page ? btnActive : btnNorm}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className={page === totalPages ? btnDis : btnNorm}
        >
          →
        </button>
      </div>

      {/* Right: per-page selector */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span>Per page:</span>
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}
          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-remed-red"
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user }  = useAuth()
  const { t }     = useLanguage()

  const [complaints, setComplaints] = useState([])
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState('all')
  const [filters,    setFilters]    = useState({ priority: '', status: '', category: '', search: '' })
  const [page,       setPage]       = useState(1)
  const [pageSize,   setPageSize]   = useState(10)

  const VIEWS = [
    { key: 'all',       label: t('viewAll') },
    { key: 'mine',      label: t('viewMine') },
    { key: 'unassigned',label: t('viewUnassigned') },
    { key: 'escalated', label: t('viewEscalated') },
  ]

  // Reset to page 1 whenever view or filters change
  useEffect(() => {
    setPage(1)
    fetchComplaints()
    if (user?.role === 'admin' || user?.role === 'technical_specialist') {
      adminApi.getUsers().then(r => setUsers(r.data)).catch(() => {})
    }
  }, [view, filters])

  async function fetchComplaints() {
    setLoading(true)
    try {
      const params = { view, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
      const { data } = await complaintsApi.list(params)
      setComplaints(data)
    } finally {
      setLoading(false)
    }
  }

  // Slice for current page
  const paginated = complaints.slice((page - 1) * pageSize, page * pageSize)

  const counts = {
    P0: complaints.filter(c => c.priority === 'P0').length,
    P1: complaints.filter(c => c.priority === 'P1').length,
    open: complaints.filter(c => !['Resolved', 'Closed'].includes(c.status)).length,
    escalated: complaints.filter(c => c.escalated).length,
  }

  const TABLE_HEADERS = [
    t('colTicket'), t('colPriority'), t('colStatus'), t('colCategory'),
    t('colDevice'), t('colLab'), t('colSubmittedBy'), t('colTeam'),
    t('colAssignedTo'), t('colDate'),
  ]

  return (
    <Layout>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: t('cardTotal'),     value: complaints.length, color: 'text-gray-900' },
          { label: t('cardOpen'),      value: counts.open,       color: 'text-yellow-600' },
          { label: 'P0/P1',            value: counts.P0 + counts.P1, color: 'text-red-600' },
          { label: t('cardEscalated'), value: counts.escalated,  color: 'text-remed-red' },
        ].map(card => (
          <div key={card.label} className="card p-4">
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              view === v.key ? 'bg-remed-red text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          className="input w-48 text-sm py-1.5"
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <select className="input w-36 text-sm py-1.5" value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
          <option value="">{t('allPriorities')}</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="input w-36 text-sm py-1.5" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">{t('allStatuses')}</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-44 text-sm py-1.5" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="">{t('allCategories')}</option>
          {[
            ['A: Machine',      'A: Machine/Device Failure'],
            ['B: Kit/Reagent',  'B: Kit/Reagent Issue'],
            ['C: Assay/Protocol','C: Assay/Protocol Issue'],
            ['D: Environmental','D: Environmental'],
          ].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <button onClick={fetchComplaints} className="btn-secondary text-sm py-1.5">{t('btnRefresh')}</button>
        {user?.role === 'admin' && (
          <button
            onClick={() => complaintsApi.export().then(r => {
              const url = URL.createObjectURL(r.data)
              const a = document.createElement('a'); a.href = url; a.download = 'complaints.csv'; a.click()
            })}
            className="btn-ghost text-sm"
          >
            {t('btnExportCsv')}
          </button>
        )}
      </div>

      {/* Table + Pagination */}
      <div className="card overflow-hidden">
        {/* Scrollable table body */}
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {TABLE_HEADERS.map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">{t('loading')}</td></tr>
              ) : complaints.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">{t('noComplaints')}</td></tr>
              ) : paginated.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link to={`/complaints/${c.id}`} className="font-mono text-xs font-semibold text-remed-red hover:underline">
                      {c.ticket_id}
                    </Link>
                    {c.escalated ? <span className="ml-1 text-xs text-red-500">🔺</span> : null}
                    {c.sla_breached ? (
                      <span title={t('slaBreached')} className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
                        ⏱ {t('slaBreach')}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate" title={c.category}>{c.category || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{c.device || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{c.lab_type || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{c.submitted_by_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{c.assigned_team || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {c.assigned_name || <span className="text-gray-300">{t('unassigned')}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <PaginationBar
          total={complaints.length}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
    </Layout>
  )
}
