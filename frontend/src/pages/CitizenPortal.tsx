import { useState } from 'react'
import { analyzeComplaint, chatbotQuery, type Complaint, type TraceStep } from '../api/client'
import VoiceRecorder from '../components/VoiceRecorder'

function ChatbotWidget() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: 'Hello! I can help you check the status of your complaint. Just type your complaint ID (e.g., "What is the status of complaint #5?")' },
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
      // Try to extract complaint_id from the query
      const idMatch = userMsg.match(/#?(\d+)/)
      const res = await chatbotQuery({
        query: userMsg,
        complaint_id: idMatch ? parseInt(idMatch[1]) : undefined,
      })
      setMessages(prev => [...prev, { role: 'bot', text: res.answer }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <span style={{ fontSize: '1.2rem' }}>🤖</span>
        <h3>Complaint Status Assistant</h3>
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
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Thinking...
          </div>
        )}
      </div>
      <div className="chatbot-input">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about a complaint (e.g., 'status of #5')"
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  )
}

export default function CitizenPortal() {
  const [transcript, setTranscript] = useState('')
  const [location, setLocation] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Complaint | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transcript.trim()) return
    setSubmitting(true)
    setError('')
    setResult(null)

    try {
      const data = await analyzeComplaint({
        transcript: transcript.trim(),
        citizen_location: location.trim() || undefined,
        citizen_id: citizenId.trim() || undefined,
      })
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Failed to submit complaint')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setTranscript('')
    setLocation('')
    setCitizenId('')
    setResult(null)
    setError('')
  }

  return (
    <>
      <div className="page-header">
        <h2>Citizen Portal</h2>
        <p>Submit a complaint or check the status of an existing one</p>
      </div>

      <div className="portal-grid">
        {/* Complaint Form */}
        <div className="card">
          <div className="card-header">
            <h3>📝 Submit a Complaint</h3>
          </div>
          <div className="card-body">
            {result ? (
              <>
                <div className="submit-success">
                  <h3>✅ Complaint Submitted Successfully</h3>
                  <div className="result-item">
                    <span className="result-label">Complaint ID</span>
                    <span className="result-value">#{result.id}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Category</span>
                    <span className="result-value" style={{ textTransform: 'capitalize' }}>{result.category || '—'}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Urgency</span>
                    <span className={`badge badge-${result.urgency || 'normal'}`}>{result.urgency || 'normal'}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Department</span>
                    <span className="result-value">{result.department_recommended || '—'}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">AI Confidence</span>
                    <span className="result-value">{Math.round((result.department_confidence || 0) * 100)}%</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Summary</span>
                    <span className="result-value">{result.summary || '—'}</span>
                  </div>
                  {result.is_duplicate_of && (
                    <div className="result-item">
                      <span className="result-label">⚠️ Duplicate</span>
                      <span className="result-value">Similar to complaint #{result.is_duplicate_of}</span>
                    </div>
                  )}
                </div>

                {/* Show reasoning trace */}
                {result.reasoning_trace && result.reasoning_trace.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 12 }}>
                      🧠 AI Processing Trace
                    </h4>
                    <div className="trace-container">
                      {result.reasoning_trace.map((step: TraceStep, i: number) => (
                        <div key={i} className={`trace-step ${step.fallback_used ? 'fallback' : ''}`}>
                          <div className="trace-connector">
                            <div className="trace-dot" />
                            {i < result.reasoning_trace!.length - 1 && <div className="trace-line" />}
                          </div>
                          <div className="trace-body">
                            <div className="trace-node-name">
                              {step.node}
                              {step.duration_ms != null && (
                                <span className="trace-duration">{Math.round(step.duration_ms)}ms</span>
                              )}
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
                  </div>
                )}

                <button className="btn btn-secondary" onClick={resetForm} style={{ marginTop: 20, width: '100%' }}>
                  Submit Another Complaint
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Voice recording option */}
                <VoiceRecorder onTranscriptReady={(text) => setTranscript(text)} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#cbd5e1' }} />
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>or text entry</span>
                  <div style={{ flex: 1, height: 1, background: '#cbd5e1' }} />
                </div>

                <div className="form-group">
                  <label>Describe your complaint *</label>
                  <textarea
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Describe the issue in detail — what happened, where, and how it affects you..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Location (optional)</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g., Anna Nagar, MG Road"
                  />
                </div>
                <div className="form-group">
                  <label>Your Name / Phone (optional)</label>
                  <input
                    type="text"
                    value={citizenId}
                    onChange={e => setCitizenId(e.target.value)}
                    placeholder="For tracking your complaint"
                  />
                </div>

                {error && (
                  <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem', marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
                  {submitting ? (
                    <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Analyzing with AI...</>
                  ) : (
                    <>🚀 Submit Complaint</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Chatbot */}
        <div>
          <ChatbotWidget />
        </div>
      </div>
    </>
  )
}
