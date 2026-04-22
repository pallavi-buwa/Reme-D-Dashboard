import { useState, useEffect } from 'react'
import { schemaApi, complaintsApi } from '../api'
import FormWizard from '../components/form/FormWizard'

const PRIORITY_INFO = {
  P0: { label: 'Critical', color: 'bg-black text-white', desc: 'Immediate response required' },
  P1: { label: 'High', color: 'bg-red-600 text-white', desc: 'Same-day response required' },
  P2: { label: 'Medium', color: 'bg-orange-100 text-orange-800', desc: 'Response within 48 hours' },
  P3: { label: 'Low', color: 'bg-blue-100 text-blue-700', desc: 'Scheduled response' },
}

export default function SubmitComplaint() {
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
      // Extract file from sections
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
      setError(err.response?.data?.error || 'Submission failed. Please try again.')
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
        <div className="max-w-md w-full card p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Report Submitted</h2>
          <p className="text-gray-500 text-sm mb-6">Your diagnostic report has been received and is being processed.</p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Ticket ID</span>
              <span className="font-mono font-bold text-gray-900">{result.ticket_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">System Priority</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${p.color}`}>{result.priority} · {p.label}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Assigned Team</span>
              <span className="text-sm font-medium text-gray-700">{result.team}</span>
            </div>
            {result.escalated && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">Escalation</span>
                <span className="text-xs text-red-600 font-medium">🔺 Escalated to management</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-3 mb-6 text-left">
            <p className="text-xs text-blue-700 font-medium mb-1">Priority Rationale</p>
            <p className="text-xs text-blue-600">{result.reasoning}</p>
          </div>

          <button
            onClick={() => { setResult(null) }}
            className="btn-primary w-full"
          >
            Submit Another Report
          </button>
          <p className="text-xs text-gray-400 mt-3">Save your ticket ID: <strong>{result.ticket_id}</strong></p>
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
            <span className="text-gray-400 text-sm">/ Technical Issue Report</span>
          </div>
          <a href="/login" className="text-sm text-remed-blue-grey hover:text-remed-red transition-colors">
            Staff Login →
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Submit a Technical Issue</h1>
          <p className="text-gray-500 text-sm mt-2">
            Complete this diagnostic form in full. Your responses are used to automatically prioritize and route the complaint to the correct team.
          </p>
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
            <div className="text-center py-8 text-gray-400">Failed to load form. Please refresh.</div>
          )}
        </div>
      </div>
    </div>
  )
}
