import { useState, useEffect } from 'react'
import { schemaApi, complaintsApi } from '../api'
import FormWizard from '../components/form/FormWizard'
import { useLanguage } from '../context/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

const PRIORITY_INFO = {
  P0: { labelKey: 'priorityCritical', color: 'bg-black text-white', descKey: 'priorityImmediateDesc' },
  P1: { labelKey: 'priorityHigh', color: 'bg-red-600 text-white', descKey: 'prioritySameDayDesc' },
  P2: { labelKey: 'priorityMedium', color: 'bg-orange-100 text-orange-800', descKey: 'priority48hDesc' },
  P3: { labelKey: 'priorityLow', color: 'bg-blue-100 text-blue-700', descKey: 'priorityScheduledDesc' },
}

export default function SubmitComplaint() {
  const { t } = useLanguage()
  const [schema, setSchema] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    schemaApi.get().then(({ data }) => { setSchema(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  async function handleSubmit(formData) {
    setSubmitting(true)
    setError('')
    try {
      const fd = new FormData()
      let file = null
      const sections = {}
      for (const [sectionName, fields] of Object.entries(formData)) {
        const cleanFields = {}
        for (const [key, val] of Object.entries(fields)) {
          if (val instanceof File) { file = val }
          else { cleanFields[key] = val }
        }
        sections[sectionName] = cleanFields
      }
      fd.append('sections', JSON.stringify(sections))
      if (file) fd.append('file', file)

      const { data } = await complaintsApi.submit(fd)
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || t('submissionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-remed-red border-t-transparent" />
    </div>
  )

  if (result) {
    const p = PRIORITY_INFO[result.priority] || PRIORITY_INFO.P3
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="fixed top-4 end-4 z-50"><LanguageToggle /></div>
        <div className="max-w-md w-full card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('reportSubmitted')}</h2>
          <p className="text-gray-500 text-sm mb-6">{t('reportReceivedMsg')}</p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">{t('ticketId')}</span>
              <span className="font-mono font-bold text-gray-900">{result.ticket_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">{t('systemPriority')}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${p.color}`}>{result.priority} · {t(p.labelKey)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">{t('assignedTeam')}</span>
              <span className="text-sm font-medium text-gray-700">{result.team}</span>
            </div>
            {result.escalated && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">{t('escalation')}</span>
                <span className="text-xs text-red-600 font-medium">{t('escalatedToMgmt')}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-3 mb-6 text-left">
            <p className="text-xs text-blue-700 font-medium mb-1">{t('priorityRationale')}</p>
            <p className="text-xs text-blue-600">{result.reasoning}</p>
          </div>

          <button onClick={() => setResult(null)} className="btn-primary w-full">
            {t('submitAnother')}
          </button>
          <p className="text-xs text-gray-400 mt-3">{t('saveTicketId')} <strong>{result.ticket_id}</strong></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Public header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-remed-red font-bold text-xl">Reme-D</span>
            <span className="text-gray-400 text-sm">{t('techIssueReport')}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <a href="/login" className="text-sm text-remed-blue-grey hover:text-remed-red transition-colors">
              {t('staffLogin')}
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('submitAnIssue')}</h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="card p-6">
          {schema ? (
            <FormWizard schema={schema} onSubmit={handleSubmit} submitting={submitting} />
          ) : (
            <div className="text-center py-8 text-gray-400">{t('formLoadFailed')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
