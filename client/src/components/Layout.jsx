import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', roles: ['admin', 'technical_specialist', 'account_manager', 'viewer'] },
  { to: '/analytics', label: 'Analytics', roles: ['admin', 'account_manager'] },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleLabel = {
    admin: 'Administrator',
    technical_specialist: 'Technical Specialist',
    account_manager: 'Account Manager',
    viewer: 'Viewer',
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-remed-red font-bold text-xl tracking-tight">Reme-D</span>
              <span className="text-remed-blue-grey text-xs font-medium hidden sm:block">Diagnostic System</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.filter(n => n.roles.includes(user?.role)).map(n => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    location.pathname.startsWith(n.to)
                      ? 'bg-remed-red text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs hidden sm:block">
              Submit Form ↗
            </a>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-gray-800">{user?.name}</div>
                <div className="text-xs text-gray-400">{roleLabel[user?.role] || user?.role}</div>
              </div>
              <button onClick={handleLogout} className="btn-secondary text-xs px-3 py-1.5">
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-gray-200 bg-white py-3 text-center text-xs text-gray-400">
        Reme-D Diagnostic Workflow System · Internal Use Only
      </footer>
    </div>
  )
}
