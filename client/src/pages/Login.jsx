import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

export default function Login() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || t('loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Language toggle — top right corner */}
      <div className="fixed top-4 end-4 z-50">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-remed-red rounded-xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reme-D</h1>
          <p className="text-sm text-gray-500 mt-1">{t('loginTitle')}</p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-5">{t('loginHeading')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('labelEmail')}</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@remed.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">{t('labelPassword')}</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-2">{t('demoAccounts')}</p>
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex justify-between"><span>admin@remed.com</span><span className="text-gray-400">Admin@123</span></div>
              <div className="flex justify-between"><span>specialist@remed.com</span><span className="text-gray-400">Spec@123</span></div>
              <div className="flex justify-between"><span>manager@remed.com</span><span className="text-gray-400">Manager@123</span></div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {t('notStaff')}{' '}
          <a href="/" className="text-remed-red hover:underline">{t('submitComplaintLink')}</a>
        </p>
      </div>
    </div>
  )
}
