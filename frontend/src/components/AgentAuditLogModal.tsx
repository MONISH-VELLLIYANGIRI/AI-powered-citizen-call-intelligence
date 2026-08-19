import { useState } from 'react'
import type { TraceStep } from '../api/client'

interface AgentAuditLogModalProps {
  complaintId: number
  category?: string
  urgency?: string
  status?: string
  createdAt?: string
  trace?: TraceStep[]
  onClose: () => void
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return 'N/A'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ` (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
  } catch {
    return isoString
  }
}

function getAgentIcon(nodeName: string): string {
  const lower = nodeName.toLowerCase()
  if (lower.includes('intake')) return '📥'
  if (lower.includes('triage')) return '⚖️'
  if (lower.includes('classify')) return '🏷️'
  if (lower.includes('duplicate')) return '🔍'
  if (lower.includes('merge')) return '🔗'
  if (lower.includes('emergency')) return '🚨'
  if (lower.includes('route') || lower.includes('department')) return '🏢'
  if (lower.includes('summarize')) return '📝'
  if (lower.includes('resolution') || lower.includes('planner')) return '📋'
  if (lower.includes('notification') || lower.includes('citizen')) return '💬'
  if (lower.includes('closure')) return '🎉'
  if (lower.includes('persist')) return '💾'
  return '🤖'
}

export default function AgentAuditLogModal({
  complaintId,
  category,
  urgency,
  status,
  createdAt,
  trace = [],
  onClose,
}: AgentAuditLogModalProps) {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState(false)

  const toggleExpand = (index: number) => {
    setExpandedIndices(prev => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const toggleAll = () => {
    const allExpanded = trace.every((_, i) => expandedIndices[i])
    if (allExpanded) {
      setExpandedIndices({})
    } else {
      const next: Record<number, boolean> = {}
      trace.forEach((_, i) => {
        next[i] = true
      })
      setExpandedIndices(next)
    }
  }

  const totalDuration = trace.reduce((acc, curr) => acc + (curr.duration_ms || 0), 0)

  const handleCopyAuditJSON = () => {
    const auditData = {
      complaint_id: complaintId,
      category,
      urgency,
      status,
      created_at: createdAt,
      total_processes: trace.length,
      cumulative_duration_ms: totalDuration,
      audit_trail: trace,
    }
    navigator.clipboard.writeText(JSON.stringify(auditData, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 180ms ease-out',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.4rem' }}>🛡️</span>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                AI Agent Audit Trail & Execution Log
              </h2>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Complaint #{complaintId}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Chronological ledger of AI agent reasoning, decisions, outputs, and execution timestamps.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              width: 32,
              height: 32,
              borderRadius: '50%',
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Telemetry Summary Stats */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 20, fontSize: '0.82rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Total Processes: </span>
              <strong style={{ color: '#0f172a' }}>{trace.length} Agents</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Cumulative Latency: </span>
              <strong style={{ color: '#0f172a' }}>{Math.round(totalDuration)} ms</strong>
            </div>
            {createdAt && (
              <div>
                <span style={{ color: '#64748b' }}>Registered At: </span>
                <strong style={{ color: '#0f172a' }}>{formatDateTime(createdAt)}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={toggleAll}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: 'pointer',
                color: '#475569',
                fontWeight: 600,
              }}
            >
              {trace.every((_, i) => expandedIndices[i]) ? 'Collapse All' : 'Expand All Details'}
            </button>
            <button
              type="button"
              onClick={handleCopyAuditJSON}
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: 'pointer',
                color: '#1e3a5f',
                fontWeight: 600,
              }}
            >
              {copied ? '✓ JSON Copied' : '📋 Export Audit Log'}
            </button>
          </div>
        </div>

        {/* Audit Steps Timeline */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {trace.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem', margin: 0 }}>No agent execution audit entries recorded yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: 6 }}>
                Audit logs are automatically generated as the LangGraph agentic pipeline runs.
              </p>
            </div>
          ) : (
            trace.map((step, idx) => {
              const isExpanded = !!expandedIndices[idx]
              const agentIcon = getAgentIcon(step.node)
              const agentTitle = step.agent_name || step.node.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid',
                    borderColor: step.fallback_used ? '#fed7aa' : '#e2e8f0',
                    borderRadius: 8,
                    background: step.fallback_used ? '#fffbeb' : '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Step Item Bar */}
                  <div
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isExpanded ? '#f8fafc' : 'transparent',
                    }}
                    onClick={() => toggleExpand(idx)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Step Number Badge */}
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: step.fallback_used ? '#f97316' : '#1e3a5f',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Title & Process Summary */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1rem' }}>{agentIcon}</span>
                          <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                            {agentTitle}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#e2e8f0',
                              color: '#475569',
                              fontFamily: 'monospace',
                            }}
                          >
                            {step.node}
                          </span>
                          {step.fallback_used && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontWeight: 700,
                              }}
                            >
                              FALLBACK
                            </span>
                          )}
                        </div>

                        {/* Plain English Process completed */}
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: '#334155',
                            marginTop: 4,
                            lineHeight: 1.4,
                          }}
                        >
                          {step.action_summary || 'Completed automated agent processing stage.'}
                        </div>
                      </div>
                    </div>

                    {/* Right side: Timestamp & Duration */}
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                        {formatDateTime(step.timestamp)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                        {step.duration_ms != null && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              background: '#f1f5f9',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            ⏱️ {Math.round(step.duration_ms)} ms
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Parameter Inspector */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                        Agent Parameters & State Output:
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 10,
                          background: '#0f172a',
                          color: '#38bdf8',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          overflowX: 'auto',
                          maxHeight: 220,
                          lineHeight: 1.4,
                        }}
                      >
                        {JSON.stringify(step.output || {}, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            🔒 Verified Immutable Reasoning Ledger • LangGraph Agents
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
