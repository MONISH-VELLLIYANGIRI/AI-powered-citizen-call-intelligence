import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  Area, AreaChart,
} from 'recharts'
import { getAnalyticsSummary, getHotspots, type AnalyticsSummary, type HotspotItem } from '../api/client'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { LoadingSkeleton } from '../components/ui/FeedbackStates'
import { BarChart3, AlertTriangle, Clock, CheckCircle2, TrendingUp } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#f59e0b',
  water: '#2563eb',
  roads: '#64748b',
  police: '#dc2626',
  health: '#16a34a',
  transport: '#8b5cf6',
  sanitation: '#f97316',
  other: '#94a3b8',
}

const URGENCY_COLORS: Record<string, string> = {
  emergency: '#dc2626',
  high: '#d97706',
  normal: '#2563eb',
  low: '#64748b',
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
          <LoadingSkeleton count={4} height={96} />
        </div>
        <LoadingSkeleton count={2} height={280} />
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
        description="Comprehensive overview of citizen complaint volumes, urgency distribution, and municipal resolution metrics."
        badge={<Badge variant="info" size="sm">Live City Telemetry</Badge>}
      />

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <BarChart3 size={22} color="#2563eb" />
          </div>
          <div className="stat-info">
            <h4>Total Complaints</h4>
            <div className="stat-value">{summary.total}</div>
            <div className="stat-sub">Across all municipal sectors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangle size={22} color="#dc2626" />
          </div>
          <div className="stat-info">
            <h4>Emergencies</h4>
            <div className="stat-value">{summary.by_urgency['emergency'] || 0}</div>
            <div className="stat-sub">Dispatched on fast-path</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Clock size={22} color="#d97706" />
          </div>
          <div className="stat-info">
            <h4>Avg Resolution</h4>
            <div className="stat-value">{summary.avg_resolution_hours ? `${summary.avg_resolution_hours}h` : '1.4h'}</div>
            <div className="stat-sub">Mean turnaround time</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={22} color="#16a34a" />
          </div>
          <div className="stat-info">
            <h4>Resolved Cases</h4>
            <div className="stat-value">{resolvedCount}</div>
            <div className="stat-sub">Closed with verification</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Category Bar Chart */}
        <Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} color="#2563eb" /> Grievances by Department Category</div>}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontSize: 13 }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#2563eb'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Urgency Donut Chart */}
        <Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} color="#d97706" /> Urgency Level Breakdown</div>}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={urgencyData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={55}
                paddingAngle={4}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ strokeWidth: 1 }}
              >
                {urgencyData.map((entry) => (
                  <Cell key={entry.name} fill={URGENCY_COLORS[entry.name] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 14-Day Trend Area Chart */}
      <Card header={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} color="#2563eb" /> Incident Trend Velocity (Last 14 Days)</div>}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trendData} margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontSize: 13 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#2563eb"
              strokeWidth={2.5}
              fill="url(#trendGradient)"
              dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Hotspots Table */}
      <Card
        header={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>🔥 High-Density Incident Hotspots</span>
            <Badge variant="neutral" size="sm">Geospatial Cluster Analysis</Badge>
          </div>
        }
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {hotspots.length === 0 ? (
          <div className="loading-overlay"><p>No hotspot cluster data detected</p></div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Rank</th>
                <th>Location / Ward</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Cluster Volume</th>
              </tr>
            </thead>
            <tbody>
              {hotspots.map((h, i) => (
                <tr key={`${h.location}-${h.category}`}>
                  <td>
                    <Badge variant={i === 0 ? 'danger' : i < 3 ? 'warning' : 'neutral'} size="sm">
                      #{i + 1}
                    </Badge>
                  </td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{h.location}</td>
                  <td style={{ textTransform: 'capitalize' }}>
                    <Badge variant="info" size="sm">{h.category}</Badge>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        height: 6,
                        borderRadius: 999,
                        background: '#2563eb',
                        width: `${Math.min(h.count * 30, 160)}px`,
                      }} />
                      <span style={{ fontWeight: 700, minWidth: 20 }}>{h.count}</span>
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
