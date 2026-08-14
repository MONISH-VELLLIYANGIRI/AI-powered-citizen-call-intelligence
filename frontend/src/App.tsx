import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import OfficerDashboard from './pages/OfficerDashboard'
import AdminAnalytics from './pages/AdminAnalytics'
import CitizenPortal from './pages/CitizenPortal'

function App() {
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
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">📋</span>
            Officer Dashboard
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">📊</span>
            Analytics
          </NavLink>
          <NavLink to="/citizen" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-icon">🏛️</span>
            Citizen Portal
          </NavLink>
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.72rem', color: '#64748b' }}>
          Hexaware Mavericks Hackathon<br />
          Track 2 — AI Citizen Intelligence
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<OfficerDashboard />} />
          <Route path="/analytics" element={<AdminAnalytics />} />
          <Route path="/citizen" element={<CitizenPortal />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
