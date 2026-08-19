import React from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { RoleProvider, useRole, type Role } from './context/RoleContext'
import LandingPage from './pages/LandingPage'
import OfficerDashboard from './pages/OfficerDashboard'
import AdminAnalytics from './pages/AdminAnalytics'
import CitizenPortal from './pages/CitizenPortal'

function RoleProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[]
  children: React.ReactElement
}) {
  const { role } = useRole()

  if (!role) {
    return <Navigate to="/" replace />
  }

  if (!allowedRoles.includes(role)) {
    // Redirect to user's assigned dashboard
    if (role === 'citizen') return <Navigate to="/citizen" replace />
    if (role === 'officer') return <Navigate to="/dashboard" replace />
    if (role === 'admin') return <Navigate to="/analytics" replace />
    return <Navigate to="/" replace />
  }

  return children
}

function AppLayout() {
  const { role, name, email, department, clearRole } = useRole()
  const navigate = useNavigate()
  const location = useLocation()

  // If no role selected and on root path, show Landing Page
  if (!role || location.pathname === '/') {
    return <LandingPage />
  }

  const handleSwitchRole = () => {
    clearRole()
    navigate('/')
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>
            <span className="brand-icon">⚡</span>
            Call Intelligence
          </h1>
          <p>AI-Powered Citizen Services</p>
        </div>

        {/* Role-Filtered Navigation */}
        <nav className="sidebar-nav">
          {role === 'officer' && (
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon">📋</span>
              Officer Dashboard
            </NavLink>
          )}

          {role === 'admin' && (
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon">📊</span>
              Admin Analytics
            </NavLink>
          )}

          {role === 'citizen' && (
            <NavLink to="/citizen" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon">🏛️</span>
              Citizen Portal
            </NavLink>
          )}
        </nav>

        {/* Active Role Profile & Switch Role Footer */}
        <div className="sidebar-profile-footer">
          <div className="profile-badge-card">
            <div className="profile-avatar">
              {role === 'citizen' ? '👤' : role === 'officer' ? '👮' : '📊'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{name || 'User'}</span>
              <span className="profile-role-title">
                {role === 'citizen'
                  ? `Citizen • ${email || 'Portal'}`
                  : role === 'officer'
                  ? `Officer • ${department || 'General'}`
                  : 'System Administrator'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-switch-role"
            onClick={handleSwitchRole}
            title="Switch Persona / Log Out"
          >
            🔄 Switch Role
          </button>

          <div className="sidebar-hackathon-credit">
            Hexaware Mavericks Hackathon<br />
            Track 2 — AI Citizen Intelligence
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to={role === 'citizen' ? '/citizen' : role === 'admin' ? '/analytics' : '/dashboard'} replace />} />
          <Route
            path="/dashboard"
            element={
              <RoleProtectedRoute allowedRoles={['officer']}>
                <OfficerDashboard />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <RoleProtectedRoute allowedRoles={['admin']}>
                <AdminAnalytics />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/citizen"
            element={
              <RoleProtectedRoute allowedRoles={['citizen']}>
                <CitizenPortal />
              </RoleProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <RoleProvider>
      <AppLayout />
    </RoleProvider>
  )
}

export default App
