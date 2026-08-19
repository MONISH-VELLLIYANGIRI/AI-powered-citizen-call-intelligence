import { useState, useEffect, useCallback } from 'react'
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
import { EmptyState, LoadingSkeleton } from '../components/ui/FeedbackStates'
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
          <div key={i} className="trace-card">
            <div className="trace-card-header">
              <div className="trace-agent-badge">
                <span className="trace-agent-icon">{meta.icon}</span>
                <span style={{ color: '#0f172a' }}>{meta.title}</span>
              </div>
              <div className="trace-meta-pills">
                {step.timestamp && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    🕒 {formatTraceTime(step.timestamp)}
                  </span>
                )}
                {step.duration_ms != null && (
                  <span className="trace-duration-pill">
                    ⏱️ {Math.round(step.duration_ms)}ms
                  </span>
                )}
                {step.fallback_used && <Badge variant="warning" size="sm">FALLBACK</Badge>}
              </div>
            </div>

            <div className="trace-card-body">
              {step.action_summary && (
                <p className="trace-action-text">
                  {step.action_summary}
                </p>
              )}

              {step.output && Object.keys(step.output).length > 0 && (
                <div className="trace-kv-grid">
                  {Object.entries(step.output).map(([key, value]) => {
                    const isStr = typeof value === 'string'
                    const isNum = typeof value === 'number'
                    const isBool = typeof value === 'boolean'
                    const valType = isStr ? 'string' : isNum ? 'number' : isBool ? 'boolean' : 'object'
                    const displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value)

                    return (
                      <div key={key} className="trace-kv-row">
                        <span className="trace-key">{key}:</span>
                        <span className={`trace-val ${valType}`}>{displayVal}</span>
                      </div>
                    )
                  })}
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
  const [activeTab, setActiveTab] = useState<'my_active' | 'needs_review' | 'resolved'>('my_active')
  const [deptFilter, setDeptFilter] = useState<'my_dept' | 'all'>(roleDept ? 'my_dept' : 'all')
  const [queueItems, setQueueItems] = useState<OfficerQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  // Selected complaint detail
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Complaint | null>(null)
  const [timeline, setTimeline] = useState<ComplaintTimelineEntry[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Collapsible toggles & audit modal
  const [showTranscript, setShowTranscript] = useState(false)
  const [showReasoning, setShowReasoning] = useState(false)
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
        title="Officer Workspace"
        description={
          roleName
            ? `Logged in as ${roleName} • ${roleDept ? `Assigned to ${roleDept}` : 'All Departments'}`
            : 'Review confidence gates, action resolution checklists, and manage multi-agent dispatches'
        }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant={activeTab === 'my_active' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('my_active')}
              >
                📥 Active Queue ({activeTab === 'my_active' ? filteredQueueItems.length : '...'})
              </Button>
              <Button
                variant={activeTab === 'needs_review' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('needs_review')}
              >
                ⚠️ Needs Review ({activeTab === 'needs_review' ? filteredQueueItems.length : '...'})
              </Button>
              <Button
                variant={activeTab === 'resolved' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveTab('resolved')}
              >
                ✅ Resolved ({activeTab === 'resolved' ? filteredQueueItems.length : '...'})
              </Button>
            </div>

            {/* Department Quick Filter */}
            {roleDept && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '4px', borderRadius: 8 }}>
                <button
                  type="button"
                  onClick={() => setDeptFilter('my_dept')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    background: deptFilter === 'my_dept' ? '#ffffff' : 'transparent',
                    color: deptFilter === 'my_dept' ? '#0f172a' : '#64748b',
                    boxShadow: deptFilter === 'my_dept' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  🏢 {roleDept}
                </button>
                <button
                  type="button"
                  onClick={() => setDeptFilter('all')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 6,
                    border: 'none',
                    background: deptFilter === 'all' ? '#ffffff' : 'transparent',
                    color: deptFilter === 'all' ? '#0f172a' : '#64748b',
                    boxShadow: deptFilter === 'all' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  🌐 All ({queueItems.length})
                </button>
              </div>
            )}
          </div>

          {/* Queue Cards Grid */}
          {loading ? (
            <div className="stat-grid">
              <LoadingSkeleton count={3} height={180} />
            </div>
          ) : filteredQueueItems.length === 0 ? (
            <EmptyState
              icon="📋"
              title={deptFilter === 'my_dept' && roleDept ? `No ${activeTab.replace('_', ' ')} cases for ${roleDept}` : 'Queue is Clear'}
              description={deptFilter === 'my_dept' && roleDept ? 'Toggle to view all departments to see city-wide cases.' : 'No cases pending in this category.'}
              actionLabel={deptFilter === 'my_dept' && roleDept ? `Show All Departments (${queueItems.length})` : undefined}
              onAction={deptFilter === 'my_dept' && roleDept ? () => setDeptFilter('all') : undefined}
            />
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
              {/* Header Action Card (Full Width Hero) */}
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

              {/* Balanced 2-Column Workspace Grid */}
              <div className="workspace-grid-balanced">
                {/* Left Column: Checklist & Action Workspace */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Collapsible Transcript & AI Summary */}
                <Card style={{ marginBottom: 20 }}>
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
                  style={{ marginBottom: 20 }}
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

              {/* Right Column: Reasoning & Timeline Logs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Department Recommended Card */}
                {detail.department_recommended && (
                  <Card style={{ marginBottom: 20 }}>
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

                {/* Timeline Component */}
                <Card header="📜 Citizen-Visible Timeline & Logs" style={{ marginBottom: 20 }}>
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

                {/* Collapsible Agent Reasoning Trace */}
                <Card>
                  <div
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => setShowReasoning(prev => !prev)}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {showReasoning ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      🛡️ Agent Reasoning Audit Trail ({detail.reasoning_trace?.length || 0})
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{showReasoning ? 'Collapse' : 'Inspect'}</span>
                  </div>

                  {showReasoning && (
                    <ReasoningTrace
                      trace={detail.reasoning_trace || []}
                      onOpenModal={() => setShowAuditModal(true)}
                    />
                  )}
                </Card>
              </div>
            </div>
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
