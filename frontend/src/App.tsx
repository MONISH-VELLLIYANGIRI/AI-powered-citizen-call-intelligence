import React from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, BarChart3, Users, LogOut, Zap, User, Briefcase, ShieldAlert, Clock, BrainCircuit } from 'lucide-react'
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
            <span className="brand-icon">
              <Zap size={20} color="#ffffff" />
            </span>
            Call Intelligence
          </h1>
          <p>AI-Powered Citizen Services</p>
        </div>

        {/* Role-Filtered Navigation */}
        <nav className="sidebar-nav">
          {role === 'officer' && (
            <>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '16px 12px 8px', letterSpacing: '0.05em' }}>WORKSPACE</div>
              <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-icon"><LayoutDashboard size={18} /></span>
                Officer Workspace
              </NavLink>

              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '24px 12px 8px', letterSpacing: '0.05em' }}>CASE MANAGEMENT</div>
              <NavLink to="/dashboard/timeline" className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-icon"><Clock size={18} /></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Citizen Timeline</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Live updates & logs</span>
                </div>
              </NavLink>

              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', margin: '24px 12px 8px', letterSpacing: '0.05em' }}>✨ AI INTELLIGENCE</div>
              <NavLink to="/dashboard/audit" className={({ isActive }) => (isActive ? 'active' : '')}>
                <span className="nav-icon"><BrainCircuit size={18} /></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>AI Audit Trail</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Agent processing details</span>
                </div>
              </NavLink>
            </>
          )}

          {role === 'admin' && (
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon"><BarChart3 size={18} /></span>
              Admin Analytics
            </NavLink>
          )}

          {role === 'citizen' && (
            <NavLink to="/citizen" className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon"><Users size={18} /></span>
              Citizen Portal
            </NavLink>
          )}
        </nav>

        {/* Active Role Profile & Switch Role Footer */}
        <div className="sidebar-profile-footer">
          <div className="profile-badge-card">
            <div className="profile-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
              {role === 'citizen' ? <User size={20} /> : role === 'officer' ? <Briefcase size={20} /> : <ShieldAlert size={20} />}
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
            <LogOut size={14} /> Switch Role
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
            path="/dashboard/*"
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
