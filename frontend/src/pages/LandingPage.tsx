import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRole, type Role } from '../context/RoleContext'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Building2, ClipboardList, BarChart3, ArrowRight, Zap } from 'lucide-react'

const DEPARTMENTS = [
  'Electricity Board',
  'Water Department',
  'Roads & Municipal',
  'Police Control Room',
  'Health Services',
  'Transport Authority',
  'Disaster Management',
  'General/Other',
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { setRoleProfile } = useRole()

  // Citizen form state
  const [citizenName, setCitizenName] = useState('Monish V')
  const [citizenEmail, setCitizenEmail] = useState('citizen@example.com')

  // Officer form state
  const [officerName, setOfficerName] = useState('Officer Sharma')
  const [officerDept, setOfficerDept] = useState('Electricity Board')

  // Admin form state
  const [adminName, setAdminName] = useState('Municipal Director')
  const [adminPasscode, setAdminPasscode] = useState('')

  const handleSelectRole = (role: Role) => {
    if (role === 'citizen') {
      setRoleProfile({
        role: 'citizen',
        name: citizenName.trim() || 'Citizen',
        email: citizenEmail.trim() || 'citizen@example.com',
      })
      navigate('/citizen')
    } else if (role === 'officer') {
      setRoleProfile({
        role: 'officer',
        name: officerName.trim() || 'Officer',
        department: officerDept,
      })
      navigate('/dashboard')
    } else if (role === 'admin') {
      setRoleProfile({
        role: 'admin',
        name: adminName.trim() || 'Admin',
      })
      navigate('/analytics')
    }
  }

  return (
    <div className="landing-container">
      {/* Centered Product Branding Header */}
      <header className="landing-header">
        <div className="landing-brand-badge">
          <div className="landing-brand-icon">
            <Zap size={36} color="#ffffff" />
          </div>
          <div className="landing-brand-text">
            <h1>Call Intelligence</h1>
            <p>AI-Powered Citizen Services & Autonomous Resolution</p>
          </div>
        </div>
        <div className="landing-demo-pill">
          <span className="demo-dot" /> Live Hackathon Demo
        </div>
        <p className="landing-subheading">
          Enter as a Citizen, Case Officer, or Admin to explore end-to-end voice intake, autonomous routing, and municipal analytics.
        </p>
      </header>

      {/* 3 Role Selection Cards */}
      <div className="landing-cards-grid">
        {/* Role 1: Citizen Portal */}
        <div className="role-card citizen-card">
          <div className="role-card-header">
            <div className="role-icon-box citizen-accent">
              <Building2 size={28} />
            </div>
            <div>
              <h3>Citizen Portal</h3>
              <Badge variant="info" size="sm">Public Workspace</Badge>
            </div>
          </div>

          <p className="role-description">
            Register grievances via voice or text, monitor live milestones, and receive instant AI agent follow-ups.
          </p>

          <div className="role-form">
            <Input
              label="Full Name"
              value={citizenName}
              onChange={e => setCitizenName(e.target.value)}
              placeholder="e.g., Monish V"
            />
            <Input
              label="Email ID (for tracking)"
              type="email"
              value={citizenEmail}
              onChange={e => setCitizenEmail(e.target.value)}
              placeholder="e.g., citizen@example.com"
            />
          </div>

          <Button
            variant="primary"
            className="btn-role-action"
            onClick={() => handleSelectRole('citizen')}
          >
            Enter as Citizen <ArrowRight size={18} />
          </Button>
        </div>

        {/* Role 2: Officer Dashboard */}
        <div className="role-card officer-card">
          <div className="role-card-header">
            <div className="role-icon-box officer-accent">
              <ClipboardList size={28} />
            </div>
            <div>
              <h3>Officer Dashboard</h3>
              <Badge variant="success" size="sm">Operational Queue</Badge>
            </div>
          </div>

          <p className="role-description">
            Review triaged cases, execute resolution steps, dispatch crews, and inspect AI routing reasoning.
          </p>

          <div className="role-form">
            <Input
              label="Officer Name"
              value={officerName}
              onChange={e => setOfficerName(e.target.value)}
              placeholder="e.g., Officer Sharma"
            />
            <Select
              label="Assigned Department"
              value={officerDept}
              onChange={e => setOfficerDept(e.target.value)}
              options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
            />
          </div>

          <Button
            variant="primary"
            className="btn-role-action"
            onClick={() => handleSelectRole('officer')}
            style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
          >
            Enter as Officer <ArrowRight size={18} />
          </Button>
        </div>

        {/* Role 3: Admin Analytics */}
        <div className="role-card admin-card">
          <div className="role-card-header">
            <div className="role-icon-box admin-accent">
              <BarChart3 size={28} />
            </div>
            <div>
              <h3>Admin Analytics</h3>
              <Badge variant="neutral" size="sm">Executive Telemetry</Badge>
            </div>
          </div>

          <p className="role-description">
            Monitor real-time city grievance metrics, department SLA performance, and incident hotspots.
          </p>

          <div className="role-form">
            <Input
              label="Admin Name"
              value={adminName}
              onChange={e => setAdminName(e.target.value)}
              placeholder="e.g., Municipal Director"
            />
            <Input
              label="Demo Passcode (optional)"
              type="password"
              value={adminPasscode}
              onChange={e => setAdminPasscode(e.target.value)}
              placeholder="Leave blank for demo"
            />
          </div>

          <Button
            variant="primary"
            className="btn-role-action"
            onClick={() => handleSelectRole('admin')}
            style={{ backgroundColor: '#7C3AED', borderColor: '#7C3AED' }}
          >
            Enter as Admin <ArrowRight size={18} />
          </Button>
        </div>
      </div>

      {/* Footer info */}
      <footer className="landing-footer">
        <span>Hexaware Mavericks Hackathon • AI-Powered Citizen Intelligence</span>
      </footer>
    </div>
  )
}
