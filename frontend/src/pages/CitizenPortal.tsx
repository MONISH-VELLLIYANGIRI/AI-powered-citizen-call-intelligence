import { useState, useEffect } from 'react'
import {
  analyzeComplaint,
  autoResolveComplaint,
  chatbotQuery,
  getCitizenComplaints,
  getComplaint,
  getTimeline,
  sendCitizenFollowup,
  type Complaint,
  type ComplaintListItem,
  type ComplaintTimelineEntry,
} from '../api/client'
import { useRole } from '../context/RoleContext'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge, StatusBadge, UrgencyBadge } from '../components/ui/Badge'
import { EmptyState, LoadingSkeleton } from '../components/ui/FeedbackStates'
import { Timeline } from '../components/ui/Timeline'
import VoiceRecorder from '../components/VoiceRecorder'
import {
  Send,
  Zap,
  CheckCircle2,
  Search,
  Bot,
  PlusCircle,
  FolderOpen,
  ArrowRight,
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

function ChatbotWidget({ defaultComplaintId }: { defaultComplaintId?: number }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Hello! I can help you check real-time resolution progress or status of your complaint. (e.g., "What is happening with complaint #5?")' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const idMatch = userMsg.match(/#?(\d+)/)
      const compId = idMatch ? parseInt(idMatch[1]) : defaultComplaintId
      const res = await chatbotQuery({
        query: userMsg,
        complaint_id: compId,
      })
      setMessages(prev => [...prev, { role: 'bot', text: res.answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error checking status. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <Bot size={18} color="#2563eb" />
        <h3>AI Grievance Assistant</h3>
      </div>
      <div className="chatbot-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            {m.text.split('\n').map((line, j) => (
              <span key={j}>{line}<br /></span>
            ))}
          </div>
        ))}
        {loading && (
          <div className="chat-message bot" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ui-spinner" style={{ width: 14, height: 14 }} />
            Checking municipal records...
          </div>
        )}
      </div>
      <div className="chatbot-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about your complaint (e.g., 'Status of #5')"
          disabled={loading}
        />
        <Button variant="primary" size="sm" onClick={handleSend} disabled={loading} icon={<Send size={13} />}>
          Send
        </Button>
      </div>
    </div>
  )
}

function extractLocationAndEmail(text: string): { location?: string; email?: string } {
  if (!text) return {}
  const res: { location?: string; email?: string } = {}

  const standardEmailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i)
  if (standardEmailMatch) {
    res.email = standardEmailMatch[0].toLowerCase()
  } else {
    const spokenEmailMatch = text.match(/(?:email|mail\s*id|mail)\s*(?:is|:)?\s*([a-zA-Z0-9._%+-]+)\s*at\s*([a-zA-Z0-9.-]+)\s*dot\s*([a-zA-Z]{2,})/i)
    if (spokenEmailMatch) {
      res.email = `${spokenEmailMatch[1]}@${spokenEmailMatch[2]}.${spokenEmailMatch[3]}`.toLowerCase()
    }
  }

  const locationPatterns = [
    /(?:my\s+)?location\s*(?:is|:)\s*([A-Za-z0-9\s,]+?)(?=\s+(?:and|my|email|mail|is|phone|with|\.)|$)/i,
    /(?:located\s+at|located\s+in)\s*([A-Za-z0-9\s,]+?)(?=\s+(?:and|my|email|mail|is|phone|with|\.)|$)/i,
    /(?:from|at|in)\s+([A-Z][a-zA-Z0-9\s]+(?:Nagar|Road|Street|Avenue|Colony|Layout|Cross|Main|Bridge|Park|Gate|City|Town|District|Puram|Pakkam|Wala|Gunj)?)/i,
  ]

  for (const pat of locationPatterns) {
    const match = text.match(pat)
    if (match && match[1]) {
      const loc = match[1].trim()
      const cleaned = loc.replace(/^(is|a|the|at|in|near)\s+/i, '').trim()
      if (cleaned.length >= 3 && !cleaned.toLowerCase().includes('email') && !cleaned.toLowerCase().includes('mail')) {
        res.location = cleaned
        break
      }
    }
  }

  return res
}

export default function CitizenPortal() {
  const { email: roleEmail, name: roleName } = useRole()
  const [tab, setTab] = useState<'new_complaint' | 'my_complaints'>('new_complaint')

  // Submission Form State
  const [transcript, setTranscript] = useState('')
  const [location, setLocation] = useState('')
  const [citizenId, setCitizenId] = useState(roleEmail || '')
  const [isLocationAutofilled, setIsLocationAutofilled] = useState(false)
  const [isEmailAutofilled, setIsEmailAutofilled] = useState(Boolean(roleEmail))
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState<Complaint | null>(null)
  const [autoResolving, setAutoResolving] = useState(false)
  const [error, setError] = useState('')

  // Satisfaction Rating State
  const [rating, setRating] = useState<number>(5)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  // My Complaints & Detail State
  const [searchCitizenId, setSearchCitizenId] = useState(roleEmail || '')
  const [myComplaints, setMyComplaints] = useState<ComplaintListItem[]>([])
  const [loadingComplaints, setLoadingComplaints] = useState(false)
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null)
  const [complaintDetail, setComplaintDetail] = useState<Complaint | null>(null)
  const [timeline, setTimeline] = useState<ComplaintTimelineEntry[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [followupMessage, setFollowupMessage] = useState('')
  const [sendingFollowup, setSendingFollowup] = useState(false)

  useEffect(() => {
    if (tab === 'my_complaints') {
      fetchMyComplaints(searchCitizenId)
    }
  }, [tab])

  const handleTranscriptChange = (newTranscript: string) => {
    setTranscript(newTranscript)
    const { location: extractedLoc, email: extractedEmail } = extractLocationAndEmail(newTranscript)

    if (extractedLoc && (!location || isLocationAutofilled)) {
      setLocation(extractedLoc)
      setIsLocationAutofilled(true)
    }

    if (extractedEmail && (!citizenId || isEmailAutofilled)) {
      setCitizenId(extractedEmail)
      setIsEmailAutofilled(true)
    }
  }

  const handleVoiceTranscription = (text: string) => {
    handleTranscriptChange(text)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transcript.trim()) {
      setError('Please describe your grievance or record a voice note.')
      return
    }

    setSubmitting(true)
    setError('')
    setSubmissionResult(null)

    try {
      const res = await analyzeComplaint(
        { transcript, citizen_location: location, citizen_id: citizenId },
        autoResolveEnabled
      )
      setSubmissionResult(res)
    } catch (err: any) {
      setError(err.message || 'Failed to submit grievance. Please verify backend service.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTriggerAutoResolve = async (complaintId: number) => {
    setAutoResolving(true)
    try {
      await autoResolveComplaint(complaintId)
      if (tab === 'my_complaints' && selectedComplaintId === complaintId) {
        await openComplaintDetail(complaintId)
      } else {
        const detail = await getComplaint(complaintId)
        setSubmissionResult(detail)
      }
    } catch (err: any) {
      alert(`Auto-resolution failed: ${err.message || 'Error running agents'}`)
    } finally {
      setAutoResolving(false)
    }
  }

  const handleRatingSubmit = async (complaintId: number) => {
    if (!complaintId) return
    try {
      await sendCitizenFollowup(
        complaintId,
        `⭐ Citizen Satisfaction Rating: ${rating}/5 Stars. ${ratingFeedback ? `Feedback: "${ratingFeedback}"` : ''}`
      )
      setRatingSubmitted(true)
      if (selectedComplaintId === complaintId) {
        await openComplaintDetail(complaintId)
      }
    } catch (e) {
      console.error('Failed to submit rating:', e)
    }
  }

  const resetForm = () => {
    setTranscript('')
    setLocation('')
    setCitizenId(roleEmail || '')
    setIsLocationAutofilled(false)
    setIsEmailAutofilled(Boolean(roleEmail))
    setSubmissionResult(null)
    setRatingSubmitted(false)
    setRating(5)
    setRatingFeedback('')
    setError('')
  }

  const fetchMyComplaints = async (idFilter?: string) => {
    setLoadingComplaints(true)
    try {
      const data = await getCitizenComplaints(idFilter)
      setMyComplaints(data)
    } catch (e) {
      console.error('Failed to load citizen complaints:', e)
    } finally {
      setLoadingComplaints(false)
    }
  }

  const openComplaintDetail = async (id: number) => {
    setSelectedComplaintId(id)
    setLoadingDetail(true)
    try {
      const [compData, timeData] = await Promise.all([
        getComplaint(id),
        getTimeline(id, true),
      ])
      setComplaintDetail(compData)
      setTimeline(timeData)
    } catch (e) {
      console.error('Failed to load complaint detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSendFollowup = async () => {
    if (!selectedComplaintId || !followupMessage.trim()) return
    setSendingFollowup(true)
    try {
      await sendCitizenFollowup(selectedComplaintId, followupMessage.trim())
      setFollowupMessage('')
      await openComplaintDetail(selectedComplaintId)
    } catch (e) {
      console.error('Failed to send follow-up message:', e)
    } finally {
      setSendingFollowup(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Citizen Services"
        description={
          roleName
            ? `Welcome, ${roleName} • Register issues with AI transcription, monitor milestone progress, and message case officers.`
            : 'Register issues with AI transcription, monitor live resolution milestones, and communicate with municipal officers.'
        }
      />

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <Button
          variant={tab === 'new_complaint' ? 'primary' : 'secondary'}
          size="sm"
          icon={<PlusCircle size={15} />}
          onClick={() => {
            setTab('new_complaint')
            setSelectedComplaintId(null)
          }}
        >
          Register New Grievance
        </Button>
        <Button
          variant={tab === 'my_complaints' ? 'primary' : 'secondary'}
          size="sm"
          icon={<FolderOpen size={15} />}
          onClick={() => setTab('my_complaints')}
        >
          My Cases & Live Tracking
        </Button>
      </div>

      <div className="workspace-grid-balanced">
        {/* Left Column: Form or Tracking Details */}
        <div>
          {tab === 'new_complaint' ? (
            <Card
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📝 Register Municipal Grievance</span>
                </div>
              }
            >
              {submissionResult ? (
                <div style={{ padding: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={22} color="#16a34a" />
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>
                        {submissionResult.status === 'resolved' ? 'Grievance Resolved by Autonomous Agents' : 'Grievance Registered & Acknowledged'}
                      </h3>
                    </div>
                    <StatusBadge status={submissionResult.status} />
                  </div>

                  {/* Official AI Auto-Response Banner */}
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 20,
                    fontSize: '13.5px',
                    color: '#14532d',
                    lineHeight: 1.5,
                  }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      🤖 Official AI Acknowledgment:
                    </strong>
                    <p style={{ margin: 0 }}>
                      {submissionResult.draft_citizen_ack || `We have received your grievance regarding ${submissionResult.category} at ${submissionResult.citizen_location}. It is assigned to ${submissionResult.department_recommended} as Ticket #${submissionResult.id}.`}
                    </p>
                  </div>

                  {/* Grievance Summary Key-Values */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Ticket ID</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '15px' }}>#{submissionResult.id}</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Category</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px', textTransform: 'capitalize' }}>{submissionResult.category || 'General'}</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Department</span>
                      <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: '14px' }}>🏢 {submissionResult.department_recommended || 'Assigned'}</p>
                    </div>
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Urgency</span>
                      <div style={{ marginTop: 4 }}><UrgencyBadge urgency={submissionResult.urgency} /></div>
                    </div>
                  </div>

                  {/* Star Rating Widget if Resolved */}
                  {submissionResult.status === 'resolved' && (
                    <div style={{
                      padding: 16,
                      background: '#eff6ff',
                      borderRadius: 10,
                      border: '1px solid #bfdbfe',
                      marginBottom: 20,
                    }}>
                      <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1e3a5f' }}>
                        🌟 Citizen Resolution Satisfaction Rating
                      </h4>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '1.4rem',
                              cursor: 'pointer',
                              filter: star <= rating ? 'none' : 'grayscale(100%) opacity(30%)',
                            }}
                          >
                            ⭐
                          </button>
                        ))}
                        <span style={{ fontSize: '13px', color: '#475569', alignSelf: 'center', marginLeft: 8 }}>
                          {rating}/5 Stars
                        </span>
                      </div>
                      <Input
                        placeholder="Optional feedback: e.g. 'Very swift response!'"
                        value={ratingFeedback}
                        onChange={e => setRatingFeedback(e.target.value)}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={ratingSubmitted}
                        onClick={() => handleRatingSubmit(submissionResult.id)}
                      >
                        {ratingSubmitted ? '✓ Rating Recorded! Thank you' : 'Submit Rating'}
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {submissionResult.status !== 'resolved' && (
                      <Button
                        variant="primary"
                        icon={<Zap size={14} />}
                        loading={autoResolving}
                        onClick={() => handleTriggerAutoResolve(submissionResult.id)}
                      >
                        {autoResolving ? 'Agents Executing...' : 'Run Autonomous AI Resolution'}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      icon={<ArrowRight size={14} />}
                      onClick={() => {
                        setTab('my_complaints')
                        openComplaintDetail(submissionResult.id)
                      }}
                    >
                      Track Live Milestones
                    </Button>
                    <Button variant="ghost" onClick={resetForm}>
                      New Grievance
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {error && (
                    <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: '13px', marginBottom: 16 }}>
                      {error}
                    </div>
                  )}

                  {/* Voice Recorder Integration */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: 6, display: 'block' }}>
                      🎙️ Speak Your Grievance (Voice Intake & Auto-Fill)
                    </label>
                    <VoiceRecorder onTranscriptReady={handleVoiceTranscription} />
                  </div>

                  <div className="ui-form-group">
                    <label className="ui-label">
                      Describe the Grievance / Transcript <span className="ui-required-mark">*</span>
                    </label>
                    <textarea
                      value={transcript}
                      onChange={e => handleTranscriptChange(e.target.value)}
                      placeholder="e.g. Water pipe leakage near 12th Cross Malleshwaram. Low water pressure since morning..."
                      style={{ width: '100%', minHeight: 110, padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                    <Input
                      label="Location / Ward"
                      placeholder="e.g. Malleshwaram 12th Cross"
                      value={location}
                      onChange={e => {
                        setLocation(e.target.value)
                        setIsLocationAutofilled(false)
                      }}
                      helpText={isLocationAutofilled ? '✨ Extracted automatically from speech' : undefined}
                    />
                    <Input
                      label="Email ID / Phone"
                      placeholder="e.g. citizen@example.com"
                      value={citizenId}
                      onChange={e => {
                        setCitizenId(e.target.value)
                        setIsEmailAutofilled(false)
                      }}
                      helpText={isEmailAutofilled ? '✨ Extracted automatically from speech' : undefined}
                    />
                  </div>

                  {/* Instant Autonomous Resolution Toggle */}
                  <div style={{
                    margin: '16px 0 20px',
                    padding: '12px 14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚡ Instant Autonomous Multi-Agent Resolution
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Simulate end-to-end municipal dispatch, technical repair, and automated resolution
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoResolveEnabled}
                      onChange={e => setAutoResolveEnabled(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                    icon={<Send size={15} />}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    {submitting ? 'Processing Grievance with AI Agents...' : 'Submit Grievance to Municipality'}
                  </Button>
                </form>
              )}
            </Card>
          ) : (
            /* My Complaints & Tracking */
            <div>
              {selectedComplaintId ? (
                /* Complaint Milestone Detail */
                loadingDetail || !complaintDetail ? (
                  <LoadingSkeleton count={3} height={120} />
                ) : (
                  <div>
                    <Card
                      header={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CategoryIcon category={complaintDetail.category} />
                            <span>Case #{complaintDetail.id}</span>
                            <StatusBadge status={complaintDetail.status} />
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedComplaintId(null)}
                          >
                            ← Back to List
                          </Button>
                        </div>
                      }
                      style={{ marginBottom: 20 }}
                    >
                      <p style={{ fontSize: '14px', color: '#0f172a', margin: '0 0 12px' }}>
                        {complaintDetail.summary || complaintDetail.transcript}
                      </p>
                      <div style={{ display: 'flex', gap: 16, fontSize: '12px', color: '#64748b' }}>
                        <span>📍 {complaintDetail.citizen_location || 'Location not specified'}</span>
                        <span>🏢 {complaintDetail.department_recommended || 'General'}</span>
                      </div>

                      {complaintDetail.status !== 'resolved' && (
                        <div style={{ marginTop: 16 }}>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Zap size={14} />}
                            loading={autoResolving}
                            onClick={() => handleTriggerAutoResolve(complaintDetail.id)}
                          >
                            Run Autonomous AI Resolution
                          </Button>
                        </div>
                      )}
                    </Card>

                    {/* Stepper Timeline for Milestones */}
                    <Card header="📍 Resolution Milestones & Live Status" style={{ marginBottom: 20 }}>
                      <Timeline
                        steps={(complaintDetail.resolution_steps || []).map((step, idx) => ({
                          id: step.id,
                          title: step.step_text,
                          subtitle: step.status === 'done'
                            ? `✓ Completed ${step.completed_at ? new Date(step.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}`
                            : 'Pending municipal crew execution',
                          status: step.status === 'done' ? 'completed' : idx === 0 ? 'current' : 'pending',
                          badgeText: step.owner,
                        }))}
                      />
                    </Card>

                    {/* Timeline Activity Log */}
                    <Card header="💬 Municipal Activity & Officer Messages" style={{ marginBottom: 20 }}>
                      <Timeline
                        steps={timeline.map(t => ({
                          id: t.id,
                          title: t.actor.toUpperCase(),
                          subtitle: t.message,
                          timestamp: new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                          status: 'completed',
                        }))}
                      />

                      {/* Citizen Follow-up Input */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                        <Input
                          placeholder="Send a follow-up inquiry to the case officer..."
                          value={followupMessage}
                          onChange={e => setFollowupMessage(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSendFollowup()}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Send size={14} />}
                          loading={sendingFollowup}
                          disabled={!followupMessage.trim()}
                          onClick={handleSendFollowup}
                        >
                          Send
                        </Button>
                      </div>
                    </Card>
                  </div>
                )
              ) : (
                /* Complaints List View */
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    <Input
                      placeholder="Filter by Email or Citizen ID..."
                      value={searchCitizenId}
                      onChange={e => setSearchCitizenId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fetchMyComplaints(searchCitizenId)}
                    />
                    <Button
                      variant="secondary"
                      icon={<Search size={14} />}
                      onClick={() => fetchMyComplaints(searchCitizenId)}
                    >
                      Search
                    </Button>
                  </div>

                  {loadingComplaints ? (
                    <LoadingSkeleton count={3} height={90} />
                  ) : myComplaints.length === 0 ? (
                    <EmptyState
                      icon="📂"
                      title="No Grievances Found"
                      description="You have not submitted any complaints under this email yet."
                      actionLabel="Register Grievance"
                      onAction={() => setTab('new_complaint')}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {myComplaints.map(item => (
                        <Card
                          key={item.id}
                          hoverable
                          compact
                          onClick={() => openComplaintDetail(item.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CategoryIcon category={item.category} />
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>#{item.id}</span>
                              <Badge variant="neutral" size="sm">{item.category}</Badge>
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                          <p style={{ fontSize: '13px', color: '#334155', margin: '8px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.summary || item.transcript_excerpt}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                            <span>📍 {item.citizen_location || 'Unknown location'}</span>
                            <span>{new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: AI Assistant Chatbot */}
        <div>
          <ChatbotWidget defaultComplaintId={selectedComplaintId || submissionResult?.id || undefined} />
        </div>
      </div>
    </>
  )
}
