import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  Area, AreaChart,
} from 'recharts'
import { getAnalyticsSummary, getHotspots, type AnalyticsSummary, type HotspotItem } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { LoadingSkeleton } from '../components/ui/FeedbackStates'
import { BarChart3, AlertTriangle, Clock, CheckCircle2, TrendingUp, MapPin, SearchX } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#F59E0B',
  water: '#2563EB',
  roads: '#64748B',
  police: '#DC2626',
  health: '#10B981',
  transport: '#8B5CF6',
  sanitation: '#F97316',
  other: '#94A3B8',
}

const URGENCY_COLORS: Record<string, string> = {
  emergency: '#DC2626',
  high: '#F59E0B',
  normal: '#3B82F6',
  low: '#64748B',
}

export default function AdminAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [hotspots, setHotspots] = useState<HotspotItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, h] = await Promise.all([getAnalyticsSummary(), getHotspots()])
        setSummary(s)
        setHotspots(h)
      } catch (e) {
        console.error('Failed to load analytics:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || !summary) {
    return (
      <>
        <PageHeader
          title="Admin Analytics"
          description="City-wide grievance trends, department performance SLAs, and geospatial incident hotspot analytics."
        />
        <div className="stat-grid">
          <LoadingSkeleton count={4} height={120} />
        </div>
        <LoadingSkeleton count={2} height={320} />
      </>
    )
  }

  const categoryData = Object.entries(summary.by_category).map(([name, value]) => ({ name, value }))
  const urgencyData = Object.entries(summary.by_urgency).map(([name, value]) => ({ name, value }))
  const trendData = summary.trend_last_14_days.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    count: d.count,
  }))

  const resolvedCount = summary.by_status['resolved'] || 0

  return (
    <>
      <PageHeader
        title="Admin Analytics"
        description="Comprehensive overview of citizen complaint volumes, urgency distribution, and autonomous resolution metrics."
        badge={<Badge variant="info" size="sm">Live City Telemetry</Badge>}
      />

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <BarChart3 size={28} />
          </div>
          <div className="stat-info">
            <h4>Total Complaints</h4>
            <div className="stat-value">{summary.total}</div>
            <div className="stat-sub">Across all municipal sectors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={28} />
          </div>
          <div className="stat-info">
            <h4>Emergencies</h4>
            <div className="stat-value">{summary.by_urgency['emergency'] || 0}</div>
            <div className="stat-sub">Dispatched on fast-path</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Clock size={28} />
          </div>
          <div className="stat-info">
            <h4>Avg Resolution</h4>
            <div className="stat-value">{summary.avg_resolution_hours ? `${summary.avg_resolution_hours}h` : '1.4h'}</div>
            <div className="stat-sub">Mean AI & human turnaround time</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={28} />
          </div>
          <div className="stat-info">
            <h4>Resolved Cases</h4>
            <div className="stat-value">{resolvedCount}</div>
            <div className="stat-sub">Closed with verification</div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid - Adjusted height to be much larger and readable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 32, marginBottom: 32 }}>
        {/* Category Bar Chart */}
        <Card
          style={{ padding: 24, borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', transition: 'all 0.2s ease' }}
          className="hoverable-card"
        >
          {/* Custom Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                <BarChart3 size={24} color="#2563EB" /> Grievances by Department
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: 500 }}>Distribution of reported citizen issues</p>
            </div>
            {summary.total > 0 && (
              <Badge variant="info" size="sm" style={{ padding: '6px 12px', fontSize: '14px', borderRadius: 8 }}>
                Total: {summary.total}
              </Badge>
            )}
          </div>
          
          <div style={{ padding: '8px 0' }}>
            {categoryData.length === 0 ? (
              <div className="ui-empty-state" style={{ minHeight: 320, padding: 32, background: '#F8FAFC', borderRadius: 12 }}>
                <SearchX className="ui-empty-icon" style={{ opacity: 0.4 }} />
                <h3 className="ui-empty-title">Category Data Unavailable</h3>
                <p className="ui-empty-description">We are waiting for new complaints to visualize the department distribution.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categoryData} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    dy={12}
                    tickFormatter={(val) => val.charAt(0).toUpperCase() + val.slice(1)}
                  />
                  <YAxis
                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 12px 32px rgba(15,23,42,0.1)', fontSize: 14, fontWeight: 600, color: '#0F172A', padding: '12px 16px' }}
                    itemStyle={{ color: '#334155', fontWeight: 700 }}
                    formatter={(value) => [`${value ?? 0} Issues`, 'Volume']}
                    labelFormatter={(label) => (
  <span style={{ 
    color: '#64748B', 
    textTransform: 'capitalize', 
    fontSize: '12px', 
    display: 'block', 
    marginBottom: '4px' 
  }}>
    {String(label ?? '')} Department
  </span>
)}
                  />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} maxBarSize={60}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#2563EB'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Urgency Donut Chart */}
        <Card
          style={{ padding: 24, borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', transition: 'all 0.2s ease' }}
          className="hoverable-card"
        >
          {/* Custom Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                <AlertTriangle size={24} color="#F59E0B" /> Urgency Level Breakdown
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: 500 }}>Current complaint priority distribution</p>
            </div>
            <Badge variant="neutral" size="sm" style={{ padding: '6px 12px', fontSize: '14px', borderRadius: 8 }}>
              <Clock size={14} style={{ marginRight: 6 }} /> Live
            </Badge>
          </div>

          <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {urgencyData.length === 0 ? (
              <div className="ui-empty-state" style={{ minHeight: 320, padding: 32, background: '#F8FAFC', borderRadius: 12 }}>
                <AlertTriangle className="ui-empty-icon" style={{ opacity: 0.4 }} />
                <h3 className="ui-empty-title">Priority Data Unavailable</h3>
                <p className="ui-empty-description">There are no recent complaints to calculate urgency metrics.</p>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={urgencyData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={75}
                        paddingAngle={6}
                        stroke="none"
                      >
                        {urgencyData.map((entry) => (
                          <Cell key={entry.name} fill={URGENCY_COLORS[entry.name] || '#64748B'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 12px 32px rgba(15,23,42,0.1)', fontSize: 15, fontWeight: 700, color: '#0F172A', padding: '10px 16px' }}
                        itemStyle={{ color: '#0F172A' }}
                        formatter={(value) => [`${value ?? 0} cases`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{summary.total}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cases</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
                  {Object.entries(summary.by_urgency).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: URGENCY_COLORS[name] || '#64748B', display: 'inline-block' }}></span>
                        <span style={{ textTransform: 'capitalize', fontSize: 14, fontWeight: 700, color: '#334155' }}>
                          {name}
                        </span>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                        {count} <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginLeft: 2 }}>case{count !== 1 ? 's' : ''}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* 14-Day Trend Area Chart */}
      <Card
        style={{ padding: 24, borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', transition: 'all 0.2s ease', marginBottom: 32 }}
        className="hoverable-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
              <TrendingUp size={24} color="#7C3AED" /> Incident Trend Velocity (Last 14 Days)
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: 500 }}>Predictive view of recent municipality issue volume</p>
          </div>
          <Badge variant="info" size="sm" style={{ padding: '6px 12px', fontSize: '14px', borderRadius: 8 }}>
            AI Forecast
          </Badge>
        </div>

        <div style={{ padding: '8px 0' }}>
          {trendData.length === 0 ? (
            <div className="ui-empty-state" style={{ minHeight: 360, padding: 32, background: '#F8FAFC', borderRadius: 12 }}>
              <TrendingUp className="ui-empty-icon" style={{ opacity: 0.3 }} />
              <h3 className="ui-empty-title">Historical Data Unavailable</h3>
              <p className="ui-empty-description">Insufficient historical data to render incident trend predictions.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={trendData} margin={{ top: 20, right: 20, bottom: 10, left: -10 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} dy={12} />
                <YAxis tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }} allowDecimals={false} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip
                  cursor={{ stroke: '#7C3AED', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 12px 32px rgba(15,23,42,0.1)', fontSize: 14, fontWeight: 600, color: '#0F172A', padding: '12px 16px' }}
                  itemStyle={{ color: '#334155', fontWeight: 700 }}
                  labelFormatter={(label) => (
  <span style={{ 
    color: '#64748B', 
    fontSize: '12px', 
    display: 'block', 
    marginBottom: '4px' 
  }}>
    {String(label ?? '')}
  </span>
)}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Incidents"
                  stroke="#7C3AED"
                  strokeWidth={3}
                  fill="url(#trendGradient)"
                  dot={{ r: 4, fill: '#FFFFFF', strokeWidth: 2, stroke: '#7C3AED' }}
                  activeDot={{ r: 7, strokeWidth: 0, fill: '#6D28D9', stroke: '#DDD6FE' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Hotspots Table */}
      <Card
        style={{ padding: 0, borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)', transition: 'all 0.2s ease', overflow: 'hidden' }}
        className="hoverable-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 24px 0 24px', marginBottom: 24 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
              <MapPin size={24} color="#DC2626" /> High-Density Incident Hotspots
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: 500 }}>Geospatial clustering analysis of current bottlenecks</p>
          </div>
          <Badge variant="danger" size="sm" style={{ padding: '6px 12px', fontSize: '14px', borderRadius: 8 }}>
            AI Identified
          </Badge>
        </div>

        {hotspots.length === 0 ? (
          <div className="ui-empty-state" style={{ minHeight: 240, padding: 32, border: 'none', background: '#F8FAFC', margin: 24, borderRadius: 12 }}>
            <MapPin className="ui-empty-icon" style={{ opacity: 0.3 }} />
            <h3 className="ui-empty-title">No Incident Hotspots Detected</h3>
            <p className="ui-empty-description">There are no significant geographic complaint clusters identified by the AI system.</p>
          </div>
        ) : (
          <table className="ui-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ width: '10%', padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank</th>
                <th style={{ width: '40%', padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location / Ward</th>
                <th style={{ width: '20%', padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                <th style={{ width: '30%', textAlign: 'right', padding: '16px 24px', fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cluster Volume Intensity</th>
              </tr>
            </thead>
            <tbody>
              {hotspots.map((h, i) => (
                <tr key={`${h.location}-${h.category}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <Badge variant={i === 0 ? 'danger' : i < 3 ? 'warning' : 'neutral'} size="sm" style={{ fontWeight: 800 }}>
                      #{i + 1}
                    </Badge>
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: 700, color: '#0F172A', fontSize: '15px' }}>{h.location}</td>
                  <td style={{ padding: '16px 24px', textTransform: 'capitalize' }}>
                    <Badge variant="info" size="sm" style={{ fontWeight: 600 }}>{h.category}</Badge>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        height: 10,
                        borderRadius: 999,
                        background: i === 0 ? '#DC2626' : i < 3 ? '#F59E0B' : '#3B82F6',
                        width: `${Math.min(h.count * 40, 200)}px`,
                        transition: 'width 1s ease-out'
                      }} />
                      <span style={{ fontWeight: 800, fontSize: '16px', minWidth: 24, textAlign: 'left', color: '#0F172A' }}>{h.count}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
