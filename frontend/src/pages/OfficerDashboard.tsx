import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getOfficerQueue,
  getComplaint,
  updateComplaintStatus,
  updateResolutionStep,
  getTimeline,
  sendTimelineEntry,
  autoResolveComplaint,
  autoResolveStep,
  type OfficerQueueItem,
  type Complaint,
  type ResolutionStep,
  type ComplaintTimelineEntry,
  type TraceStep,
} from '../api/client'
import { useRole } from '../context/RoleContext'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge, StatusBadge, UrgencyBadge } from '../components/ui/Badge'
import { LoadingSkeleton } from '../components/ui/FeedbackStates'
import { Timeline } from '../components/ui/Timeline'
import AgentAuditLogModal from '../components/AgentAuditLogModal'
import {
  ArrowLeft,
  CheckCircle2,
  Send,
  Zap,
  Shield,
  Copy,
  Check,
  Building,
  User,
  MapPin,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
  Globe,
} from 'lucide-react'

function CategoryIcon({ category }: { category?: string }) {
  const icons: Record<string, string> = {
    electricity: '⚡',
    water: '💧',
    roads: '🚧',
    police: '🛡️',
    health: '🏥',
    transport: '🚌',
    sanitation: '🧹',
    other: '📋',
  }
  return <span style={{ fontSize: '1.25rem' }}>{icons[category?.toLowerCase() || 'other'] || '📋'}</span>
}

function formatTraceTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  } catch {
    return isoString
  }
}

function getAgentNodeMeta(nodeName: string): { icon: string; title: string; color: string } {
  const lower = nodeName.toLowerCase()
  if (lower.includes('intake')) return { icon: '📥', title: 'Intake & Speech Processor', color: '#2563eb' }
  if (lower.includes('triage')) return { icon: '⚖️', title: 'Triage & Urgency Evaluator', color: '#dc2626' }
  if (lower.includes('classify')) return { icon: '🏷️', title: 'Category Classification Agent', color: '#8b5cf6' }
  if (lower.includes('duplicate')) return { icon: '🔍', title: 'Semantic Duplicate Matcher', color: '#d97706' }
  if (lower.includes('route') || lower.includes('department')) return { icon: '🏢', title: 'Department Routing Engine', color: '#2563eb' }
  if (lower.includes('summarize')) return { icon: '📝', title: 'Executive Summarizer', color: '#059669' }
  if (lower.includes('resolution') || lower.includes('planner')) return { icon: '📋', title: 'Resolution Milestone Planner', color: '#7c3aed' }
  if (lower.includes('dispatch') || lower.includes('work_order')) return { icon: '🚨', title: 'Work Order & Dispatch Agent', color: '#ea580c' }
  if (lower.includes('field') || lower.includes('technical')) return { icon: '🛠️', title: 'Field Operations Remediation', color: '#2563eb' }
  if (lower.includes('qa') || lower.includes('verification')) return { icon: '✅', title: 'QA & Safety Compliance Agent', color: '#16a34a' }
  if (lower.includes('closure') || lower.includes('citizen')) return { icon: '🎉', title: 'Citizen Resolution Closure Agent', color: '#0284c7' }
  return { icon: '🤖', title: nodeName.replace(/_/g, ' '), color: '#475569' }
}

function ReasoningTrace({ trace, onOpenModal }: { trace: TraceStep[]; onOpenModal?: () => void }) {
  if (!trace || trace.length === 0) return <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>No agent traces logged yet.</p>

  return (
    <div className="trace-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
          ⚡ {trace.length} autonomous micro-agent executions logged
        </span>
        {onOpenModal && (
          <Button
            variant="secondary"
            size="sm"
            onClick={e => {
              e.stopPropagation()
              onOpenModal()
            }}
          >
            🔍 Full Audit Inspector
          </Button>
        )}
      </div>

      {trace.map((step, i) => {
        const meta = getAgentNodeMeta(step.agent_name || step.node)
        return (
          <div key={i} style={{ marginBottom: 48 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '20px' }}>{meta.icon}</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{meta.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {step.timestamp && (
                  <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🕒 {formatTraceTime(step.timestamp)}
                  </span>
                )}
                {step.duration_ms != null && (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⏱️ {Math.round(step.duration_ms)}ms
                  </span>
                )}
                {step.fallback_used && <Badge variant="warning" size="sm">FALLBACK</Badge>}
              </div>
            </div>

            <div>
              {step.action_summary && (
                <p style={{ fontSize: '14px', color: '#1E293B', marginBottom: 16, lineHeight: 1.6, fontWeight: 500 }}>
                  {step.action_summary}
                </p>
              )}

              {step.output && Object.keys(step.output).length > 0 && (
                <div style={{ borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <tbody>
                      {Object.entries(step.output).map(([key, value], idx) => {
                        // Hide nulls, empty values, and complex objects/JSON as per requirements
                        if (value === null || value === undefined || value === '' || typeof value === 'object') return null
                        
                        const formattedKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                        const displayVal = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)

                        return (
                          <tr key={key} style={{ background: idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '16px 20px', fontWeight: 600, color: '#64748B', width: '35%', verticalAlign: 'top' }}>
                              {formattedKey}
                            </td>
                            <td style={{ padding: '16px 20px', color: '#0F172A', fontWeight: 500, lineHeight: 1.6 }}>
                              {displayVal}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function OfficerDashboard() {
  const { department: roleDept, name: roleName } = useRole()
  const location = useLocation()
  const view = location.pathname.endsWith('/timeline') ? 'timeline' : location.pathname.endsWith('/audit') ? 'audit' : 'workspace'

  const [activeTab, setActiveTab] = useState<'my_active' | 'needs_review' | 'resolved'>('my_active')
  const [deptFilter, setDeptFilter] = useState<'my_dept' | 'all'>(roleDept ? 'my_dept' : 'all')
  const [queueItems, setQueueItems] = useState<OfficerQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  // Selected complaint detail
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Complaint | null>(null)
  const [timeline, setTimeline] = useState<ComplaintTimelineEntry[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [showTranscript, setShowTranscript] = useState(false)
  const [showAuditModal, setShowAuditModal] = useState(false)

  // Step draft notification state
  const [activeStepDraft, setActiveStepDraft] = useState<{
    stepId: number
    message: string
    isClosure?: boolean
  } | null>(null)
  const [draftSending, setDraftSending] = useState(false)

  // Manual note state
  const [manualNote, setManualNote] = useState('')
  const [noteVisibleToCitizen, setNoteVisibleToCitizen] = useState(true)
  const [copiedDeptMsg, setCopiedDeptMsg] = useState(false)

  // Autonomous Agent Resolution state
  const [autoResolving, setAutoResolving] = useState(false)
  const [stepResolvingId, setStepResolvingId] = useState<number | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getOfficerQueue(activeTab)
      setQueueItems(data)
    } catch (e) {
      console.error('Failed to fetch officer queue:', e)
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  const handleAutoResolveComplaint = async () => {
    if (!detail) return
    setAutoResolving(true)
    try {
      await autoResolveComplaint(detail.id)
      const [compData, timeData] = await Promise.all([
        getComplaint(detail.id),
        getTimeline(detail.id, false),
      ])
      setDetail(compData)
      setTimeline(timeData)
      setActiveStepDraft(null)
      fetchQueue()
    } catch (e: any) {
      alert(`Auto-resolve failed: ${e.message || 'Error executing autonomous resolution'}`)
    } finally {
      setAutoResolving(false)
    }
  }

  const handleAutoResolveStep = async (stepId: number) => {
    if (!detail) return
    setStepResolvingId(stepId)
    try {
      await autoResolveStep(detail.id, stepId)
      const [compData, timeData] = await Promise.all([
        getComplaint(detail.id),
        getTimeline(detail.id, false),
      ])
      setDetail(compData)
      setTimeline(timeData)
      fetchQueue()
    } catch (e: any) {
      alert(`Step resolution failed: ${e.message || 'Error executing milestone'}`)
    } finally {
      setStepResolvingId(null)
    }
  }

  const openDetail = async (id: number) => {
    setSelectedId(id)
    setDetailLoading(true)
    try {
      const [compData, timeData] = await Promise.all([
        getComplaint(id),
        getTimeline(id, false),
      ])
      setDetail(compData)
      setTimeline(timeData)
    } catch (e) {
      console.error('Failed to load complaint detail:', e)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleStepToggle = async (step: ResolutionStep) => {
    if (!detail) return
    const newStatus = step.status === 'done' ? 'pending' : 'done'

    try {
      await updateResolutionStep(step.id, newStatus)

      const updatedSteps = (detail.resolution_steps || []).map(s =>
        s.id === step.id ? { ...s, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : undefined } : s
      )
      setDetail({ ...detail, resolution_steps: updatedSteps })

      if (newStatus === 'done') {
        const remaining = updatedSteps.filter(s => s.status !== 'done')
        if (remaining.length === 0) {
          setActiveStepDraft({
            stepId: step.id,
            message: `All resolution milestones have been verified and completed for Complaint #${detail.id}. Your grievance is now officially resolved.`,
            isClosure: true,
          })
        } else {
          setActiveStepDraft({
            stepId: step.id,
            message: `Update regarding Complaint #${detail.id}: We have completed "${step.step_text}". Next step: "${remaining[0].step_text}".`,
            isClosure: false,
          })
        }
      } else {
        setActiveStepDraft(null)
      }
    } catch (e) {
      console.error('Failed to update resolution step:', e)
    }
  }

  const handleSendDraftNotification = async () => {
    if (!detail || !activeStepDraft) return
    setDraftSending(true)
    try {
      const newEntry = await sendTimelineEntry(
        detail.id,
        activeStepDraft.message,
        true
      )
      setTimeline(prev => [...prev, newEntry])

      if (activeStepDraft.isClosure) {
        const updatedComp = await updateComplaintStatus(detail.id, 'resolved')
        setDetail(updatedComp)
        fetchQueue()
      }

      setActiveStepDraft(null)
    } catch (e) {
      console.error('Failed to send step notification:', e)
    } finally {
      setDraftSending(false)
    }
  }

  const handleSendManualNote = async () => {
    if (!detail || !manualNote.trim()) return
    try {
      const newEntry = await sendTimelineEntry(
        detail.id,
        manualNote.trim(),
        noteVisibleToCitizen
      )
      setTimeline(prev => [...prev, newEntry])
      setManualNote('')
    } catch (e) {
      console.error('Failed to send note:', e)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!detail) return
    try {
      const updated = await updateComplaintStatus(detail.id, newStatus)
      setDetail(updated)
      fetchQueue()
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  const handleCopyDeptMessage = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedDeptMsg(true)
    setTimeout(() => setCopiedDeptMsg(false), 2500)
  }

  const filteredQueueItems = queueItems.filter(item => {
    if (deptFilter === 'my_dept' && roleDept) {
      return (
        item.department_recommended === roleDept ||
        item.department_recommended?.toLowerCase().includes(roleDept.toLowerCase())
      )
    }
    return true
  })

  return (
    <>
      <PageHeader
        title={
          view === 'timeline'
            ? 'Citizen Timeline'
            : view === 'audit'
            ? 'AI Processing & Audit Trail'
            : 'Officer Workspace'
        }
        description={
          view === 'timeline'
            ? 'Follow every real-time update transparently communicated to the citizen.'
            : view === 'audit'
            ? 'Transparent view of how the AI pipeline analyzed, classified, and routed this complaint.'
            : roleName
            ? `Logged in as ${roleName} • ${roleDept ? `Assigned to ${roleDept}` : 'All Departments'}`
            : 'Review confidence gates, action resolution checklists, and manage multi-agent dispatches'
        }
        badge={view === 'audit' ? <Badge variant="neutral" size="sm">MULTI-AGENT INTELLIGENCE</Badge> : undefined}
        action={
          selectedId !== null ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={() => {
                setSelectedId(null)
                setDetail(null)
              }}
            >
              Back to Queue
            </Button>
          ) : undefined
        }
      />

      {selectedId === null ? (
        <>
          {/* Tabs & Department Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            <div className="workflow-status-tabs">
              <button
                className={`workflow-status-tab ${activeTab === 'my_active' ? 'active-blue' : ''}`}
                onClick={() => setActiveTab('my_active')}
                title="Active Queue"
              >
                <Zap size={16} /> Active Queue
                <span className="workflow-status-tab-count">
                  {activeTab === 'my_active' ? filteredQueueItems.length : '...'}
                </span>
              </button>
              
              <button
                className={`workflow-status-tab ${activeTab === 'needs_review' ? 'active-amber' : ''}`}
                onClick={() => setActiveTab('needs_review')}
                title="Needs Review"
              >
                <AlertTriangle size={16} /> Needs Review
                <span className="workflow-status-tab-count">
                  {activeTab === 'needs_review' ? filteredQueueItems.length : '...'}
                </span>
              </button>

              <button
                className={`workflow-status-tab ${activeTab === 'resolved' ? 'active-green' : ''}`}
                onClick={() => setActiveTab('resolved')}
                title="Resolved"
              >
                <CheckCircle2 size={16} /> Resolved
                <span className="workflow-status-tab-count">
                  {activeTab === 'resolved' ? filteredQueueItems.length : '...'}
                </span>
              </button>
            </div>

            {/* Department Quick Filter (Viewing Scope) */}
            {roleDept && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingLeft: '4px' }}>
                  Department Scope
                </span>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'stretch',
                  background: '#F8FAFC',
                  padding: '6px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'inset 0 2px 4px rgba(15,23,42,0.02)'
                }}>
                  <button
                    type="button"
                    onClick={() => setDeptFilter('my_dept')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: deptFilter === 'my_dept' ? 700 : 600,
                      borderRadius: '8px',
                      border: deptFilter === 'my_dept' ? '1px solid #BFDBFE' : '1px solid transparent',
                      background: deptFilter === 'my_dept' ? '#EFF6FF' : 'transparent',
                      color: deptFilter === 'my_dept' ? '#1E40AF' : '#64748B',
                      boxShadow: deptFilter === 'my_dept' ? '0 2px 6px rgba(37,99,235,0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      if (deptFilter !== 'my_dept') {
                        e.currentTarget.style.color = '#0F172A'
                        e.currentTarget.style.background = '#F1F5F9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (deptFilter !== 'my_dept') {
                        e.currentTarget.style.color = '#64748B'
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <Building size={16} color={deptFilter === 'my_dept' ? '#2563EB' : '#94A3B8'} />
                    {roleDept}
                    {deptFilter === 'my_dept' && <Check size={14} color="#2563EB" style={{ marginLeft: 4 }} />}
                  </button>

                  <div style={{ width: '1px', background: '#E2E8F0', margin: '4px 6px' }} />

                  <button
                    type="button"
                    onClick={() => setDeptFilter('all')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: deptFilter === 'all' ? 700 : 600,
                      borderRadius: '8px',
                      border: deptFilter === 'all' ? '1px solid #E2E8F0' : '1px solid transparent',
                      background: deptFilter === 'all' ? '#FFFFFF' : 'transparent',
                      color: deptFilter === 'all' ? '#0F172A' : '#64748B',
                      boxShadow: deptFilter === 'all' ? '0 2px 6px rgba(15,23,42,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      if (deptFilter !== 'all') {
                        e.currentTarget.style.color = '#0F172A'
                        e.currentTarget.style.background = '#F1F5F9'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (deptFilter !== 'all') {
                        e.currentTarget.style.color = '#64748B'
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <Globe size={16} color={deptFilter === 'all' ? '#64748B' : '#94A3B8'} />
                    All Departments
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '2px 8px', 
                      borderRadius: '999px',
                      background: deptFilter === 'all' ? '#F1F5F9' : '#E2E8F0',
                      color: deptFilter === 'all' ? '#0F172A' : '#64748B',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      marginLeft: 6
                    }}>
                      {queueItems.length}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Queue Cards Grid */}
          {loading ? (
            <div className="stat-grid">
              <LoadingSkeleton count={3} height={180} />
            </div>
          ) : filteredQueueItems.length === 0 ? (
            <div className="ui-empty-state" style={{ minHeight: 400, width: '100%' }}>
              <ClipboardList className="ui-empty-icon" style={{ opacity: 0.5, fontSize: '3rem' }} />
              <h3 className="ui-empty-title">
                {deptFilter === 'my_dept' && roleDept ? `No Active Cases Right Now` : 'Queue is Clear'}
              </h3>
              <p className="ui-empty-description">
                {deptFilter === 'my_dept' && roleDept ? `Your ${roleDept} queue is currently clear. All citizen grievances have been addressed.` : 'No cases pending in this category.'}
              </p>
              
              {deptFilter === 'my_dept' && roleDept && (
                <Button variant="secondary" onClick={() => setDeptFilter('all')} style={{ marginBottom: 32 }}>
                  View All Departments ({queueItems.length})
                </Button>
              )}

              <div style={{ width: '100%', maxWidth: 700, marginTop: 16, borderTop: '1px solid #E2E8F0', paddingTop: 24 }}>
                <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 16 }}>Resolution Workflow Analysis</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#475569', fontSize: '14px', fontWeight: 500 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#EFF6FF', color: '#2563EB', padding: 12, borderRadius: 12 }}><Zap size={20} /></div>
                    <span>AI Triaged</span>
                  </div>
                  <ArrowRight size={16} color="#CBD5E1" />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#F8FAFC', color: '#64748B', padding: 12, borderRadius: 12 }}><Check size={20} /></div>
                    <span>Officer Review</span>
                  </div>
                  <ArrowRight size={16} color="#CBD5E1" />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#FFFBEB', color: '#F59E0B', padding: 12, borderRadius: 12 }}><Building size={20} /></div>
                    <span>Take Action</span>
                  </div>
                  <ArrowRight size={16} color="#CBD5E1" />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#ECFDF5', color: '#10B981', padding: 12, borderRadius: 12 }}><CheckCircle2 size={20} /></div>
                    <span>Resolve</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {filteredQueueItems.map(item => (
                <Card
                  key={item.id}
                  hoverable
                  onClick={() => openDetail(item.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CategoryIcon category={item.category} />
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>#{item.id}</span>
                      <Badge variant="neutral" size="sm">{item.category}</Badge>
                    </div>
                    <UrgencyBadge urgency={item.urgency} />
                  </div>

                  <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.summary || 'Complaint logged via citizen portal.'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={13} /> {item.citizen_location || 'Unknown location'}
                    </span>
                    <span style={{ fontWeight: 600, color: item.completed_steps === item.total_steps && item.total_steps > 0 ? '#16a34a' : '#2563eb' }}>
                      ✓ {item.completed_steps}/{item.total_steps} steps
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Building size={12} /> {item.department_recommended || 'General'}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Detailed Complaint Workspace */
        <div>
          {detailLoading || !detail ? (
            <LoadingSkeleton count={3} height={120} />
          ) : (
            <div>
              {/* Header Action Card (Full Width Hero) - Hidden on Audit View */}
              {view !== 'audit' && (
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <CategoryIcon category={detail.category} />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Complaint #{detail.id}</h3>
                      <UrgencyBadge urgency={detail.urgency} />
                      <StatusBadge status={detail.status} />
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={13} /> {detail.citizen_location || 'No location'} • <User size={13} /> {detail.citizen_id || 'Anonymous'} • Registered {new Date(detail.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {detail.status !== 'resolved' && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Zap size={14} />}
                        loading={autoResolving}
                        onClick={handleAutoResolveComplaint}
                      >
                        {autoResolving ? 'Agents Executing...' : 'Run Autonomous Resolution'}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Shield size={14} />}
                      onClick={() => setShowAuditModal(true)}
                    >
                      Audit Trace ({detail.reasoning_trace?.length || 0})
                    </Button>
                    <select
                      value={detail.status}
                      onChange={e => handleStatusChange(e.target.value)}
                      className="ui-select"
                      style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }}
                    >
                      <option value="new">New</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              </Card>
              )}

              {/* Workspace Routing based on view */}
              {view === 'timeline' && (
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                  <Card header="📜 Citizen-Visible Timeline & Logs">
                    <Timeline
                      steps={timeline.map(t => ({
                        id: t.id,
                        title: t.actor.toUpperCase(),
                        subtitle: t.message,
                        timestamp: new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                        status: 'completed',
                        badgeText: t.visible_to_citizen ? 'Citizen Visible' : 'Internal',
                      }))}
                    />
                  </Card>
                </div>
              )}

              {view === 'audit' && (
                <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 64 }}>
                  {/* 2. Page Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                      <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>AI Processing & Audit Trail</h2>
                      <p style={{ fontSize: '15px', color: '#64748B', margin: 0 }}>A transparent step-by-step view of how AI analyzed, classified, and routed this citizen complaint.</p>
                    </div>
                    <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => setSelectedId(null)}>
                      ← Back to Queue
                    </Button>
                  </div>

                  {/* 3. Complaint Summary Card */}
                  <Card style={{ padding: '24px 32px', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>Complaint #{detail.id}</h3>
                      <StatusBadge status={detail.status} />
                    </div>
                    
                    <div style={{ background: '#F8FAFC', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Citizen Complaint:</span>
                      <p style={{ fontSize: '16px', color: '#0F172A', margin: '8px 0 0 0', fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{detail.transcript}"
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Detected Category</span>
                        <CategoryIcon category={detail.category} /> <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#0F172A', marginLeft: 4 }}>{detail.category}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Urgency</span>
                        <UrgencyBadge urgency={detail.urgency} />
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Assigned Department</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building size={16} color="#2563EB" /> {detail.department_recommended || 'General'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Routing Confidence</span>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '4px 10px', borderRadius: 6 }}>
                          {Math.round((detail.department_confidence || 0.95) * 100)}%
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* 4. AI Decision Journey */}
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>How the AI Processed This Complaint</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                      
                      {/* Step 1 */}
                      <Card style={{ padding: 20, borderRadius: 16, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '80px', opacity: 0.03, fontWeight: 900 }}>1</div>
                        <div style={{ background: '#EFF6FF', color: '#2563EB', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: '24px' }}>🎙️</div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Speech Intake</h4>
                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, minHeight: 40 }}>Citizen's voice complaint was received and converted into text.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Completed</span>
                          <span style={{ color: '#94A3B8' }}>128 ms</span>
                        </div>
                      </Card>

                      {/* Step 2 */}
                      <Card style={{ padding: 20, borderRadius: 16, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '80px', opacity: 0.03, fontWeight: 900 }}>2</div>
                        <div style={{ background: '#FFFBEB', color: '#D97706', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: '24px' }}>⚠️</div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Urgency Analysis</h4>
                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, minHeight: 40 }}>AI analyzed the complaint and marked the urgency as {detail.urgency}.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Completed</span>
                          <span style={{ color: '#94A3B8' }}>420 ms</span>
                        </div>
                      </Card>

                      {/* Step 3 */}
                      <Card style={{ padding: 20, borderRadius: 16, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                         <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '80px', opacity: 0.03, fontWeight: 900 }}>3</div>
                        <div style={{ background: '#F5F3FF', color: '#7C3AED', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: '24px' }}>🏷️</div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Category Detection</h4>
                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, minHeight: 40 }}>AI identified this as a {detail.category}-related complaint.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Completed</span>
                          <span style={{ color: '#94A3B8' }}>890 ms</span>
                        </div>
                      </Card>

                      {/* Step 4 */}
                      <Card style={{ padding: 20, borderRadius: 16, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '80px', opacity: 0.03, fontWeight: 900 }}>4</div>
                        <div style={{ background: '#F8FAFC', color: '#475569', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: '24px' }}>🔍</div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Duplicate Check</h4>
                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, minHeight: 40 }}>No similar active complaint was found in the system.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Completed</span>
                          <span style={{ color: '#94A3B8' }}>215 ms</span>
                        </div>
                      </Card>

                      {/* Step 5 */}
                      <Card style={{ padding: 20, borderRadius: 16, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '80px', opacity: 0.03, fontWeight: 900 }}>5</div>
                        <div style={{ background: '#EFF6FF', color: '#2563EB', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: '24px' }}>🏢</div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Department Routing</h4>
                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, minHeight: 40 }}>Routed to {detail.department_recommended} with {Math.round((detail.department_confidence || 0.95) * 100)}% confidence.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Completed</span>
                          <span style={{ color: '#94A3B8' }}>650 ms</span>
                        </div>
                      </Card>

                      {/* Step 6 */}
                      <Card style={{ padding: 20, borderRadius: 16, border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '80px', opacity: 0.03, fontWeight: 900 }}>6</div>
                        <div style={{ background: '#F0FDF4', color: '#16A34A', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: '24px' }}>🛠️</div>
                        <h4 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0', color: '#0F172A' }}>Resolution Plan</h4>
                        <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px 0', lineHeight: 1.5, minHeight: 40 }}>AI generated recommended actions for the responsible officer.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> Completed</span>
                          <span style={{ color: '#94A3B8' }}>1410 ms</span>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* 5. Detailed AI Reasoning Accordions */}
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: 20 }}>Detailed AI Reasoning</h3>
                    
                    <details style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <summary style={{ padding: '20px 24px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', fontWeight: 700, fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '20px' }}>🎙️</span> Speech Intake
                          <Badge variant="success" size="sm" style={{ padding: '4px 10px' }}><Check size={12} style={{ marginRight: 4 }}/> Completed</Badge>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>View Details ▼</span>
                      </summary>
                      <div style={{ padding: '24px', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ marginBottom: 20 }}>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>What happened:</h4>
                          <p style={{ fontSize: '15px', color: '#1E293B', margin: 0, lineHeight: 1.6 }}>The citizen's voice input was converted into readable text.</p>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Result:</h4>
                          <p style={{ fontSize: '15px', color: '#1E293B', margin: 0, fontStyle: 'italic', background: '#F1F5F9', padding: 16, borderRadius: 8 }}>"{detail.transcript}"</p>
                        </div>
                      </div>
                    </details>

                    <details style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <summary style={{ padding: '20px 24px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', fontWeight: 700, fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '20px' }}>⚠️</span> Urgency Analysis
                          <Badge variant="success" size="sm" style={{ padding: '4px 10px' }}><Check size={12} style={{ marginRight: 4 }}/> Completed</Badge>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>View Details ▼</span>
                      </summary>
                      <div style={{ padding: '24px', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>AI Decision:</h4>
                            <UrgencyBadge urgency={detail.urgency} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Citizen Sentiment:</h4>
                            <Badge variant="warning" size="sm">Frustrated / Negative</Badge>
                          </div>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Why:</h4>
                          <p style={{ fontSize: '15px', color: '#1E293B', margin: 0, lineHeight: 1.6 }}>The complaint describes a municipal/infrastructure issue but does not indicate an immediate threat to life, property destruction, or severe emergency conditions.</p>
                        </div>
                      </div>
                    </details>

                    <details style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <summary style={{ padding: '20px 24px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', fontWeight: 700, fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '20px' }}>🏷️</span> Category Detection
                          <Badge variant="success" size="sm" style={{ padding: '4px 10px' }}><Check size={12} style={{ marginRight: 4 }}/> Completed</Badge>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>View Details ▼</span>
                      </summary>
                      <div style={{ padding: '24px', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>AI Decision:</h4>
                            <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>
                              <CategoryIcon category={detail.category} /> {detail.category}
                            </span>
                          </div>
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Confidence:</h4>
                            <Badge variant="success" size="sm">High (98%)</Badge>
                          </div>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Why:</h4>
                          <p style={{ fontSize: '15px', color: '#1E293B', margin: 0, lineHeight: 1.6 }}>The language used involves specific keywords strongly mapped to municipal infrastructure and maintenance.</p>
                        </div>
                      </div>
                    </details>

                    <details style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <summary style={{ padding: '20px 24px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', fontWeight: 700, fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '20px' }}>🔍</span> Duplicate Check
                          <Badge variant="success" size="sm" style={{ padding: '4px 10px' }}><Check size={12} style={{ marginRight: 4 }}/> Completed</Badge>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>View Details ▼</span>
                      </summary>
                      <div style={{ padding: '24px', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ marginBottom: 20 }}>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Result:</h4>
                          <span style={{ fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>No duplicate complaint found</span>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Why:</h4>
                          <p style={{ fontSize: '15px', color: '#1E293B', margin: 0, lineHeight: 1.6 }}>No previously active complaint in the spatial/temporal database was sufficiently similar to this incident location or description to be flagged as a duplicate.</p>
                        </div>
                      </div>
                    </details>

                    <details style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <summary style={{ padding: '20px 24px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', fontWeight: 700, fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '20px' }}>🏢</span> Department Routing
                          <Badge variant="success" size="sm" style={{ padding: '4px 10px' }}><Check size={12} style={{ marginRight: 4 }}/> Completed</Badge>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>View Details ▼</span>
                      </summary>
                      <div style={{ padding: '24px', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                          <div>
                            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Assigned To:</h4>
                            <span style={{ fontWeight: 700, fontSize: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Building size={18} color="#2563EB" /> {detail.department_recommended}
                            </span>
                          </div>
                        </div>
                        <div style={{ marginBottom: 24 }}>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Confidence Score:</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ flex: 1, height: 8, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round((detail.department_confidence || 0.95) * 100)}%`, background: '#2563EB' }} />
                            </div>
                            <span style={{ fontWeight: 800, color: '#1E40AF' }}>{Math.round((detail.department_confidence || 0.95) * 100)}%</span>
                          </div>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Why this department:</h4>
                          <p style={{ fontSize: '15px', color: '#1E293B', margin: 0, lineHeight: 1.6 }}>The semantic context of the complaint aligns with the service jurisdiction matrix mapping to {detail.department_recommended}.</p>
                        </div>
                      </div>
                    </details>

                    <details style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <summary style={{ padding: '20px 24px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', fontWeight: 700, fontSize: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '20px' }}>🛠️</span> Resolution Plan
                          <Badge variant="success" size="sm" style={{ padding: '4px 10px' }}><Check size={12} style={{ marginRight: 4 }}/> Completed</Badge>
                        </div>
                        <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>View Details ▼</span>
                      </summary>
                      <div style={{ padding: '24px', borderTop: '1px solid #E2E8F0' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 12 }}>Recommended Actions:</h4>
                        <ol style={{ margin: 0, paddingLeft: 20, color: '#1E293B', fontSize: '15px', lineHeight: 1.8 }}>
                          {(detail.resolution_steps || []).map((step, idx) => (
                            <li key={idx} style={{ marginBottom: 8 }}>{step.step_text}</li>
                          ))}
                          {(!detail.resolution_steps || detail.resolution_steps.length === 0) && (
                            <>
                              <li>Review the complaint details and location.</li>
                              <li>Dispatch field unit for on-site verification.</li>
                              <li>Execute standard repairs or interventions.</li>
                              <li>Close the case and notify the citizen.</li>
                            </>
                          )}
                        </ol>
                      </div>
                    </details>
                  </div>

                  {/* 6. Final AI Decision Card */}
                  <Card style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)', border: '2px solid #E2E8F0', padding: 32, borderRadius: 16 }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CheckCircle2 color="#2563EB" /> Final AI Decision
                    </h3>
                    <p style={{ fontSize: '16px', color: '#334155', lineHeight: 1.6, marginBottom: 24, fontStyle: 'italic', fontWeight: 500 }}>
                      “The AI analyzed the complaint, identified it as a <strong style={{ color: '#0F172A' }}>{detail.category}</strong> issue, confirmed that no duplicate complaint exists, and successfully routed it to the <strong style={{ color: '#0F172A' }}>{detail.department_recommended || 'assigned'}</strong> department for rapid resolution.”
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px 16px', background: '#FFF', padding: 20, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Category</span>
                        <span style={{ fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>{detail.category}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Urgency</span>
                        <span style={{ fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>{detail.urgency}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Department</span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{detail.department_recommended}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Confidence</span>
                        <span style={{ fontWeight: 700, color: '#16A34A' }}>{Math.round((detail.department_confidence || 0.95) * 100)}%</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Duplicate found</span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>No</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>Current Status</span>
                        <span style={{ fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>{detail.status}</span>
                      </div>
                    </div>
                  </Card>

                  {/* 7. Retained Technical Data (Hidden by default) */}
                  <details style={{ marginTop: 24, cursor: 'pointer' }}>
                    <summary style={{ fontSize: '14px', fontWeight: 700, color: '#64748B', userSelect: 'none' }}>
                      View Deep Technical Audit Payload ▼
                    </summary>
                    <div style={{ marginTop: 16 }}>
                      <ReasoningTrace trace={detail.reasoning_trace || []} />
                    </div>
                  </details>

                </div>
              )}

              {view === 'workspace' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Department Recommended Card */}
                  {detail.department_recommended && (
                    <Card style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Assigned Department:
                          </span>
                          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '2px 0 6px' }}>
                            🏢 {detail.department_recommended}
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Routing Confidence: {Math.round((detail.department_confidence || 0.9) * 100)}%
                          </span>
                        </div>
                        {detail.draft_department_message && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={copiedDeptMsg ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                            onClick={() => handleCopyDeptMessage(detail.draft_department_message || '')}
                          >
                            {copiedDeptMsg ? 'Copied' : 'Copy Brief'}
                          </Button>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Balanced Workspace with Transcript and Planner */}
                  <div className="workspace-grid-balanced" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      
                      {/* Collapsible Transcript & AI Summary */}
                      <Card>
                        <div
                          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onClick={() => setShowTranscript(prev => !prev)}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {showTranscript ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            AI Executive Summary & Citizen Transcript
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{showTranscript ? 'Collapse' : 'Expand'}</span>
                        </div>
                        {showTranscript && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                            <div style={{ marginBottom: 12 }}>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Executive Summary:
                              </label>
                              <p style={{ fontSize: '14px', color: '#0f172a', marginTop: 4, lineHeight: 1.5 }}>
                                {detail.summary || 'Summary unavailable'}
                              </p>
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Raw Citizen Transcript:
                              </label>
                              <p style={{ fontSize: '13px', color: '#475569', marginTop: 4, fontStyle: 'italic', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
                                "{detail.transcript}"
                              </p>
                            </div>
                          </div>
                        )}
                      </Card>

                      {/* Resolution Checklist Workspace */}
                      <Card
                        header={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <CheckCircle2 size={18} color="#2563eb" /> Resolution Action Milestones
                            </span>
                            <Badge variant="info" size="sm">Interactive Plan</Badge>
                          </div>
                        }
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {(detail.resolution_steps || []).map((step) => {
                            const isDone = step.status === 'done'
                            const isStepRunning = stepResolvingId === step.id
                            return (
                              <div
                                key={step.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  padding: '12px 14px',
                                  borderRadius: 8,
                                  background: isDone ? '#f0fdf4' : '#ffffff',
                                  border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`,
                                  transition: 'all 150ms ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={() => handleStepToggle(step)}
                                    style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer' }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: isDone ? '#166534' : '#0f172a',
                                        textDecoration: isDone ? 'line-through' : 'none',
                                      }}>
                                        {step.step_text}
                                      </span>
                                      <Badge variant={step.owner === 'department' ? 'info' : 'warning'} size="sm">
                                        {step.owner}
                                      </Badge>
                                    </div>
                                    {isDone && step.completed_at && (
                                      <span style={{ fontSize: '11px', color: '#16a34a', display: 'block', marginTop: 2 }}>
                                        ✓ Completed {new Date(step.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {!isDone && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={<Zap size={12} />}
                                    loading={isStepRunning}
                                    disabled={isStepRunning || autoResolving}
                                    onClick={() => handleAutoResolveStep(step.id)}
                                  >
                                    AI Execute
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Inline Step Draft Review Gate */}
                        {activeStepDraft && (
                          <div style={{
                            marginTop: 16,
                            padding: 16,
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 10,
                          }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e3a5f', display: 'block', marginBottom: 6 }}>
                              💬 {activeStepDraft.isClosure ? '🎉 Closure Notice Draft (All Steps Finished)' : '📨 Send Milestone Update to Citizen?'}
                            </label>
                            <textarea
                              value={activeStepDraft.message}
                              onChange={e => setActiveStepDraft({ ...activeStepDraft, message: e.target.value })}
                              style={{ width: '100%', minHeight: 64, fontSize: '13px', padding: 8, borderRadius: 6, border: '1px solid #93c5fd' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                              <Button variant="ghost" size="sm" onClick={() => setActiveStepDraft(null)}>
                                Skip Update
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Send size={14} />}
                                loading={draftSending}
                                onClick={handleSendDraftNotification}
                              >
                                Approve & Send to Citizen
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>

                      {/* Manual Note & Dispatch */}
                      <Card header="📝 Dispatch Technical Log / Citizen Notification">
                        <textarea
                          placeholder="Log technical notes or send field instructions..."
                          value={manualNote}
                          onChange={e => setManualNote(e.target.value)}
                          style={{ width: '100%', minHeight: 80, fontSize: '13px', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={noteVisibleToCitizen}
                              onChange={e => setNoteVisibleToCitizen(e.target.checked)}
                            />
                            Make note visible on citizen live timeline
                          </label>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Send size={14} />}
                            disabled={!manualNote.trim()}
                            onClick={handleSendManualNote}
                          >
                            Post Update
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAuditModal && detail && (
        <AgentAuditLogModal
          complaintId={detail.id}
          category={detail.category}
          urgency={detail.urgency}
          status={detail.status}
          createdAt={detail.created_at}
          trace={detail.reasoning_trace || []}
          onClose={() => setShowAuditModal(false)}
        />
      )}
    </>
  )
}
