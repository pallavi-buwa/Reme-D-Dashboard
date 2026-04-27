import { useState, useEffect } from 'react'
import { analyticsApi } from '../api'
import Layout from '../components/Layout'
import { useLanguage } from '../context/LanguageContext'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const PRIORITY_COLORS = { P0: '#000000', P1: '#D32F2F', P2: '#F57C00', P3: '#1565C0' }
const CATEGORY_COLORS = ['#D32F2F', '#546E7A', '#1565C0', '#2E7D32', '#6A1B9A']
const STATUS_COLORS = ['#9E9E9E', '#7B1FA2', '#1565C0', '#F57C00', '#D32F2F', '#2E7D32', '#616161']

function MetricCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="card p-5">
      <div className={`text-3xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const { t } = useLanguage()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsApi.summary()
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Layout>
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-remed-red border-t-transparent" />
      </div>
    </Layout>
  )

  if (!data) return <Layout><div className="text-center py-16 text-gray-400">{t('analyticsLoadFailed')}</div></Layout>

  const { summary, by_priority, by_status, by_category, by_device, by_lab_type, trend_30d } = data

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{t('analyticsTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('analyticsSubtitle')}</p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <MetricCard label={t('totalComplaints')} value={summary.total} />
        <MetricCard label={t('openComplaints')} value={summary.open} color="text-yellow-600" />
        <MetricCard label={t('escalatedComplaints')} value={summary.escalated} color="text-red-600" />
        <MetricCard
          label={t('avgResolution')}
          value={summary.avg_resolution_hours != null ? `${summary.avg_resolution_hours}h` : 'N/A'}
          sub={t('hoursToResolve')}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('priorityDistribution')}</h3>
          {by_priority.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={by_priority} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={80} label={({ priority, count }) => `${priority}: ${count}`}>
                  {by_priority.map((entry) => (
                    <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] || '#ccc'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">{t('noData')}</p>}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('statusBreakdown')}</h3>
          {by_status.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={by_status} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {by_status.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">{t('noData')}</p>}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('byCategory')}</h3>
          {by_category.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={by_category}>
                <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {by_category.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">{t('noData')}</p>}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('byDevice')}</h3>
          {by_device.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={by_device}>
                <XAxis dataKey="device" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#546E7A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">{t('noData')}</p>}
        </div>
      </div>

      {/* 30-day trend */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('trend30d')}</h3>
        {trend_30d.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend_30d}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#D32F2F" strokeWidth={2} dot={{ r: 3, fill: '#D32F2F' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-gray-400 text-center py-8">{t('noRecentSubmissions')}</p>}
      </div>

      {/* Lab type breakdown */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('byLabType')}</h3>
        {by_lab_type.length ? (
          <div className="flex flex-wrap gap-3">
            {by_lab_type.map((row, i) => (
              <div key={row.lab_type} className="flex-1 min-w-32 bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}>{row.count}</div>
                <div className="text-xs text-gray-500 mt-1">{row.lab_type}</div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">{t('noData')}</p>}
      </div>
    </Layout>
  )
}
