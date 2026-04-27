import { useLanguage } from '../context/LanguageContext'

const STATUS_STYLES = {
  New: 'bg-gray-100 text-gray-700',
  Triaged: 'bg-purple-100 text-purple-700',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  Escalated: 'bg-red-100 text-red-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-200 text-gray-500',
}

const PRIORITY_STYLES = {
  P0: 'bg-black text-white',
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-100 text-orange-800 border border-orange-200',
  P3: 'bg-blue-100 text-blue-700',
}

const STATUS_KEYS = {
  New: 'statusNew',
  Triaged: 'statusTriaged',
  Assigned: 'statusAssigned',
  'In Progress': 'statusInProgress',
  Escalated: 'statusEscalated',
  Resolved: 'statusResolved',
  Closed: 'statusClosed',
}

export function StatusBadge({ status }) {
  const { t } = useLanguage()
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${PRIORITY_STYLES[priority] || 'bg-gray-100 text-gray-600'}`}>
      {priority}
    </span>
  )
}
