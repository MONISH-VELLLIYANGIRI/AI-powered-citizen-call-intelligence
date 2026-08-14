import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts'
import { getAnalyticsSummary, getHotspots, type AnalyticsSummary, type HotspotItem } from '../api/client'

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#f59e0b',
  water: '#3b82f6',
  roads: '#6b7280',
  police: '#ef4444',
  health: '#10b981',
  transport: '#8b5cf6',
  sanitation: '#f97316',
  other: '#94a3b8',
}

const URGENCY_COLORS: Record<string, string> = {
  emergency: '#ef4444',
  high: '#f97316',
  normal: '#3b82f6',
  low: '#94a3b8',
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
      <div className="loading-overlay">
        <div className="spinner" />
        Loading analytics...
      </div>
    )
  }

  const categoryData = Object.entries(summary.by_category).map(([name, value]) => ({ name, value }))
  const urgencyData = Object.entries(summary.by_urgency).map(([name, value]) => ({ name, value }))
  const trendData = summary.trend_last_14_days.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    count: d.count,
  }))

  const resolvedThisWeek = summary.by_status['resolved'] || 0

  return (
    <>
      <div className="page-header">
        <h2>Admin Analytics</h2>
        <p>Comprehensive overview of citizen complaint patterns and resolution metrics</p>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-info">
            <h4>Total Complaints</h4>
            <div className="stat-value">{summary.total}</div>
            <div className="stat-sub">All time</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">🚨</div>
          <div className="stat-info">
            <h4>Emergencies</h4>
            <div className="stat-value">{summary.by_urgency['emergency'] || 0}</div>
            <div className="stat-sub">Requires immediate action</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">⏱️</div>
          <div className="stat-info">
            <h4>Avg Resolution</h4>
            <div className="stat-value">{summary.avg_resolution_hours ? `${summary.avg_resolution_hours}h` : 'N/A'}</div>
            <div className="stat-sub">Hours to resolve</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-info">
            <h4>Resolved</h4>
            <div className="stat-value">{resolvedThisWeek}</div>
            <div className="stat-sub">Complaints closed</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Category bar chart */}
        <div className="chart-card">
          <h3>Complaints by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Urgency pie chart */}
        <div className="chart-card">
          <h3>Urgency Breakdown</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={urgencyData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={55}
                paddingAngle={3}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ strokeWidth: 1 }}
              >
                {urgencyData.map((entry) => (
                  <Cell key={entry.name} fill={URGENCY_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 14-day trend */}
        <div className="chart-card" style={{ gridColumn: 'span 2' }}>
          <h3>Complaint Trend — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#colorCount)"
                dot={{ r: 4, fill: '#3b82f6' }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hotspots table */}
      <div className="card">
        <div className="card-header">
          <h3>🔥 Complaint Hotspots</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {hotspots.length === 0 ? (
            <div className="loading-overlay"><p>No hotspot data available</p></div>
          ) : (
            <table className="hotspot-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Location</th>
                  <th>Category</th>
                  <th>Complaint Count</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h, i) => (
                  <tr key={`${h.location}-${h.category}`}>
                    <td style={{ fontWeight: 700, color: i < 3 ? '#ef4444' : '#64748b' }}>#{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{h.location}</td>
                    <td style={{ textTransform: 'capitalize' }}>{h.category}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          height: 8, borderRadius: 999, background: `linear-gradient(90deg, #3b82f6, #2563eb)`,
                          width: `${Math.min(h.count * 40, 200)}px`,
                          transition: 'width 0.5s ease'
                        }} />
                        <span style={{ fontWeight: 700 }}>{h.count}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
