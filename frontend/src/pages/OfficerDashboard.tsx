import { useState, useEffect, useCallback } from 'react'
import {
  listComplaints,
  getComplaint,
  updateComplaintStatus,
  type ComplaintListItem,
  type Complaint,
  type TraceStep,
} from '../api/client'

// Urgency badge component
function UrgencyBadge({ urgency }: { urgency?: string }) {
  const cls = `badge badge-${urgency || 'normal'}`
  const icons: Record<string, string> = { emergency: '🔴', high: '🟠', normal: '🔵', low: '⚪' }
  return <span className={cls}>{icons[urgency || 'normal'] || '🔵'} {urgency || 'normal'}</span>
}

function StatusBadge({ status }: { status: string }) {
  const cls = `badge badge-${status.replace('_', '-')}`
  return <span className={cls}>{status.replace('_', ' ')}</span>
}

// Reasoning Trace component — the key differentiator
function ReasoningTrace({ trace }: { trace: TraceStep[] }) {
  if (!trace || trace.length === 0) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No trace available</p>

  return (
    <div className="trace-container">
      {trace.map((step, i) => (
        <div key={i} className={`trace-step ${step.fallback_used ? 'fallback' : ''}`}>
          <div className="trace-connector">
            <div className="trace-dot" />
            {i < trace.length - 1 && <div className="trace-line" />}
          </div>
          <div className="trace-body">
            <div className="trace-node-name">
              {step.node}
              {step.duration_ms != null && (
                <span className="trace-duration">{Math.round(step.duration_ms)}ms</span>
              )}
              {step.fallback_used && <span className="badge badge-high" style={{ fontSize: '0.65rem' }}>FALLBACK</span>}
            </div>
            <div className="trace-output">
              {Object.entries(step.output || {}).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}:</strong>{' '}
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function OfficerDashboard() {
  const [complaints, setComplaints] = useState<ComplaintListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Complaint | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterDept, setFilterDept] = useState('')

  const fetchComplaints = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listComplaints({
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        urgency: filterUrgency || undefined,
        department: filterDept || undefined,
      })
      setComplaints(data)
    } catch (e) {
      console.error('Failed to fetch complaints:', e)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterCategory, filterUrgency, filterDept])

  useEffect(() => { fetchComplaints() }, [fetchComplaints])

  const openDetail = async (id: number) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const data = await getComplaint(id)
      setDetail(data)
    } catch (e) {
      console.error('Failed to fetch complaint detail:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!detail) return
    try {
      const updated = await updateComplaintStatus(detail.id, newStatus)
      setDetail(updated)
      fetchComplaints()
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  const closeDetail = () => { setSelectedId(null); setDetail(null) }

  return (
    <>
      <div className="page-header">
        <h2>Officer Dashboard</h2>
        <p>Review, triage, and manage citizen complaints processed by the AI pipeline</p>
      </div>

      {/* Stat summary */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-info">
            <h4>Total Complaints</h4>
            <div className="stat-value">{complaints.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">🚨</div>
          <div className="stat-info">
            <h4>Emergencies</h4>
            <div className="stat-value">{complaints.filter(c => c.urgency === 'emergency').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">⏳</div>
          <div className="stat-info">
            <h4>In Progress</h4>
            <div className="stat-value">{complaints.filter(c => c.status === 'in_progress').length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <h4>Resolved</h4>
            <div className="stat-value">{complaints.filter(c => c.status === 'resolved').length}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <label>Filters:</label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="electricity">Electricity</option>
          <option value="water">Water</option>
          <option value="roads">Roads</option>
          <option value="police">Police</option>
          <option value="health">Health</option>
          <option value="transport">Transport</option>
          <option value="sanitation">Sanitation</option>
          <option value="other">Other</option>
        </select>
        <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}>
          <option value="">All Urgencies</option>
          <option value="emergency">Emergency</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          <option value="Electricity Board">Electricity Board</option>
          <option value="Water Department">Water Department</option>
          <option value="Roads & Municipal">Roads & Municipal</option>
          <option value="Police Control Room">Police Control Room</option>
          <option value="Health Services">Health Services</option>
          <option value="Transport Authority">Transport Authority</option>
          <option value="Disaster Management">Disaster Management</option>
          <option value="General/Other">General/Other</option>
        </select>
      </div>

      {/* Complaints table */}
      <div className="card">
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            Loading complaints...
          </div>
        ) : complaints.length === 0 ? (
          <div className="loading-overlay">
            <p>No complaints found. Submit some from the Citizen Portal or run the seed script.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Urgency</th>
                <th>Department</th>
                <th>Status</th>
                <th>Location</th>
                <th>Date</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.id} onClick={() => openDetail(c.id)}>
                  <td style={{ fontWeight: 700, color: '#1e3a5f' }}>#{c.id}</td>
                  <td style={{ textTransform: 'capitalize' }}>{c.category || '—'}</td>
                  <td><UrgencyBadge urgency={c.urgency} /></td>
                  <td style={{ fontSize: '0.82rem' }}>{c.department_recommended || '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{c.citizen_location || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td>
                    {c.is_duplicate_of && <span className="badge badge-duplicate">Duplicate</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Panel */}
      {selectedId !== null && (
        <div className="detail-overlay" onClick={closeDetail}>
          <div className="detail-panel" onClick={e => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="loading-overlay"><div className="spinner" />Loading details...</div>
            ) : (
              <>
                <div className="detail-panel-header">
                  <h3>Complaint #{detail.id}</h3>
                  <button className="detail-panel-close" onClick={closeDetail}>✕</button>
                </div>

                {/* Meta */}
                <div className="detail-section">
                  <h4>Classification</h4>
                  <div className="detail-meta">
                    <div className="detail-meta-item">
                      <label>Category</label>
                      <div className="value" style={{ textTransform: 'capitalize' }}>{detail.category || '—'}</div>
                    </div>
                    <div className="detail-meta-item">
                      <label>Urgency</label>
                      <div className="value"><UrgencyBadge urgency={detail.urgency} /></div>
                    </div>
                    <div className="detail-meta-item">
                      <label>Sentiment</label>
                      <div className="value">
                        <span className={`badge badge-${detail.sentiment || 'neutral'}`}>{detail.sentiment || 'neutral'}</span>
                      </div>
                    </div>
                    <div className="detail-meta-item">
                      <label>Status</label>
                      <select
                        className="status-select"
                        value={detail.status}
                        onChange={e => handleStatusChange(e.target.value)}
                      >
                        <option value="new">New</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Department */}
                <div className="detail-section">
                  <h4>Department Routing</h4>
                  <div className="detail-meta">
                    <div className="detail-meta-item">
                      <label>Assigned To</label>
                      <div className="value">{detail.department_recommended || '—'}</div>
                    </div>
                    <div className="detail-meta-item">
                      <label>AI Confidence</label>
                      <div className="confidence-bar">
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(detail.department_confidence || 0) * 100}%` }} />
                        </div>
                        <span className="bar-label">{Math.round((detail.department_confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duplicate */}
                {detail.is_duplicate_of && (
                  <div className="detail-section">
                    <h4>Duplicate Detection</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      This complaint is a duplicate of{' '}
                      <span
                        style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => openDetail(detail.is_duplicate_of!)}
                      >
                        Complaint #{detail.is_duplicate_of}
                      </span>
                      {detail.duplicate_confidence && (
                        <> (similarity: {Math.round(detail.duplicate_confidence * 100)}%)</>
                      )}
                    </p>
                  </div>
                )}

                {/* Summary */}
                <div className="detail-section">
                  <h4>AI Summary</h4>
                  <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>{detail.summary || 'No summary available'}</p>
                </div>

                {/* Transcript */}
                <div className="detail-section">
                  <h4>Full Transcript</h4>
                  <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.7, background: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                    {detail.transcript}
                  </p>
                </div>

                {/* Reasoning Trace — the key demo differentiator */}
                <div className="detail-section">
                  <h4>🧠 AI Reasoning Trace (LangGraph Pipeline)</h4>
                  <ReasoningTrace trace={detail.reasoning_trace || []} />
                </div>

                {/* Meta info */}
                <div className="detail-section">
                  <div className="detail-meta">
                    <div className="detail-meta-item">
                      <label>Location</label>
                      <div className="value">{detail.citizen_location || '—'}</div>
                    </div>
                    <div className="detail-meta-item">
                      <label>Input Type</label>
                      <div className="value" style={{ textTransform: 'capitalize' }}>{detail.raw_input_type}</div>
                    </div>
                    <div className="detail-meta-item">
                      <label>Created</label>
                      <div className="value">{new Date(detail.created_at).toLocaleString('en-IN')}</div>
                    </div>
                    <div className="detail-meta-item">
                      <label>Updated</label>
                      <div className="value">{new Date(detail.updated_at).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
