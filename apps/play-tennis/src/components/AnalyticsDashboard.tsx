import { useState, useEffect, useCallback } from 'react'
import { analytics, type DashboardData, type ChannelSpend, type ChannelMetrics } from '../analytics'

type DateRange = '7d' | '30d' | '90d' | 'all'
type DashboardTab = 'overview' | 'funnel' | 'channels' | 'cohorts'

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatPct(n: number): string {
  return n.toFixed(1) + '%'
}

function formatCurrency(n: number): string {
  return '$' + n.toFixed(2)
}

function getDateRange(range: DateRange): { from: string; to: string } {
  const to = new Date().toISOString()
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365
  const from = new Date(Date.now() - days * 86400000).toISOString()
  return { from, to }
}

function channelLabel(ch: string): string {
  const labels: Record<string, string> = {
    meta: 'Meta (FB/IG)',
    google: 'Google Ads',
    organic: 'Organic',
    direct: 'Direct',
    referral: 'Referral',
    social: 'Social',
    email: 'Email',
    paid_other: 'Paid Other',
  }
  return labels[ch] ?? ch
}

function channelColor(ch: string): string {
  const colors: Record<string, string> = {
    meta: '#1877F2',
    google: '#EA4335',
    organic: '#1F9D55',
    direct: '#6B7280',
    referral: '#7C3AED',
    social: '#E1306C',
    email: '#D97706',
    paid_other: '#2A5BD7',
  }
  return colors[ch] ?? '#9CA3AF'
}

function retentionColor(pct: number): string {
  if (pct >= 80) return 'var(--color-positive-primary)'
  if (pct >= 50) return '#2A5BD7'
  if (pct >= 25) return 'var(--color-warning-primary)'
  return 'var(--color-negative-primary)'
}

function retentionBg(pct: number): string {
  if (pct >= 80) return 'var(--color-positive-bg)'
  if (pct >= 50) return 'var(--color-accent-bg)'
  if (pct >= 25) return 'var(--color-warning-bg)'
  return 'var(--color-negative-bg)'
}

export default function AnalyticsDashboard({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [spendData, setSpendData] = useState<ChannelSpend[]>([])
  const [editingSpend, setEditingSpend] = useState<{ channel: string; value: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const range = getDateRange(dateRange)
    const [dashData, spend] = await Promise.all([
      analytics.fetchDashboardData(range),
      analytics.getChannelSpend(),
    ])
    setData(dashData)
    setSpendData(spend)
    setLoading(false)
  }, [dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveSpend(channel: string, value: string) {
    const amount = parseFloat(value)
    if (isNaN(amount) || amount < 0) return
    const month = new Date().toISOString().slice(0, 7)
    await analytics.saveChannelSpend(channel, month, amount)
    setEditingSpend(null)
    fetchData()
  }

  function getChannelWithSpend(channels: ChannelMetrics[]): (ChannelMetrics & { spend?: number; cac?: number })[] {
    return channels.map(ch => {
      const s = spendData.find(sp => sp.channel === ch.channel)
      const spend = s?.spend
      const cac = spend && ch.registrations > 0 ? spend / ch.registrations : undefined
      return { ...ch, spend, cac }
    })
  }

  // -- Render helpers --

  function renderMetricCard(label: string, value: string | number, sub?: string, accent?: string) {
    return (
      <div className="analytics-metric-card">
        <div className="analytics-metric-value" style={accent ? { color: accent } : undefined}>
          {value}
        </div>
        <div className="analytics-metric-label">{label}</div>
        {sub && <div className="analytics-metric-sub">{sub}</div>}
      </div>
    )
  }

  function renderOverview() {
    if (!data) return null
    const { totals } = data
    return (
      <div>
        <div className="analytics-metrics-grid">
          {renderMetricCard('Total Visitors', formatNumber(totals.total_visitors))}
          {renderMetricCard('Leads', formatNumber(totals.total_leads))}
          {renderMetricCard('Registrations', formatNumber(totals.total_registrations))}
          {renderMetricCard('Active Players', formatNumber(totals.total_active_players), 'Played 1+ match')}
        </div>

        <div className="analytics-section-title">Engagement</div>
        <div className="analytics-metrics-grid">
          {renderMetricCard('DAU', formatNumber(totals.dau), 'Daily active')}
          {renderMetricCard('WAU', formatNumber(totals.wau), 'Weekly active')}
          {renderMetricCard('MAU', formatNumber(totals.mau), 'Monthly active')}
          {renderMetricCard('Stickiness', totals.mau > 0 ? formatPct((totals.dau / totals.mau) * 100) : '--', 'DAU/MAU')}
        </div>

        <div className="analytics-section-title">Registration Trend</div>
        {renderRegChart()}
      </div>
    )
  }

  function renderRegChart() {
    if (!data || data.daily_registrations.length === 0) {
      return <div className="analytics-empty">No registration data yet</div>
    }
    // Aggregate by date across all channels
    const byDate = new Map<string, number>()
    for (const r of data.daily_registrations) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.count)
    }
    const entries = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
    const maxVal = Math.max(...entries.map(([, v]) => v), 1)

    return (
      <div className="analytics-bar-chart">
        {entries.map(([date, count]) => (
          <div key={date} className="analytics-bar-col">
            <div className="analytics-bar-value">{count}</div>
            <div
              className="analytics-bar"
              style={{
                height: `${Math.max((count / maxVal) * 100, 4)}%`,
                background: 'var(--color-positive-primary)',
              }}
            />
            <div className="analytics-bar-label">{date.slice(5)}</div>
          </div>
        ))}
      </div>
    )
  }

  function renderFunnel() {
    if (!data) return null
    const maxCount = Math.max(...data.funnel.map(f => f.count), 1)

    return (
      <div>
        <div className="analytics-section-title">Acquisition Funnel</div>
        <div className="analytics-funnel">
          {data.funnel.map((step, i) => (
            <div key={step.name} className="analytics-funnel-step">
              <div className="analytics-funnel-info">
                <span className="analytics-funnel-name">{step.name}</span>
                <span className="analytics-funnel-count">{formatNumber(step.count)}</span>
              </div>
              <div className="analytics-funnel-bar-track">
                <div
                  className="analytics-funnel-bar-fill"
                  style={{
                    width: `${Math.max((step.count / maxCount) * 100, 2)}%`,
                    background: i === 0 ? 'var(--color-accent-primary)' :
                      i === data.funnel.length - 1 ? 'var(--color-positive-primary)' :
                      `color-mix(in srgb, var(--color-accent-primary) ${100 - (i * 20)}%, var(--color-positive-primary))`,
                  }}
                />
              </div>
              {i > 0 && (
                <div className="analytics-funnel-rate">
                  {formatPct(step.rate)} conversion
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderChannels() {
    if (!data) return null
    const channelsWithSpend = getChannelWithSpend(data.channels)
    const sorted = [...channelsWithSpend].sort((a, b) => b.registrations - a.registrations)

    return (
      <div>
        <div className="analytics-section-title">Channel Performance</div>
        <div className="analytics-channel-table">
          <div className="analytics-channel-header">
            <span>Channel</span>
            <span>Visitors</span>
            <span>Leads</span>
            <span>Regs</span>
            <span>Active</span>
            <span>Spend</span>
            <span>CAC</span>
          </div>
          {sorted.map(ch => (
            <div key={ch.channel} className="analytics-channel-row">
              <span className="analytics-channel-name">
                <span className="analytics-channel-dot" style={{ background: channelColor(ch.channel) }} />
                {channelLabel(ch.channel)}
              </span>
              <span className="analytics-channel-num">{formatNumber(ch.visitors)}</span>
              <span className="analytics-channel-num">{formatNumber(ch.leads)}</span>
              <span className="analytics-channel-num">{formatNumber(ch.registrations)}</span>
              <span className="analytics-channel-num">{formatNumber(ch.active_players)}</span>
              <span className="analytics-channel-num">
                {editingSpend?.channel === ch.channel ? (
                  <input
                    className="analytics-spend-input"
                    type="number"
                    value={editingSpend.value}
                    onChange={e => setEditingSpend({ channel: ch.channel, value: e.target.value })}
                    onBlur={() => handleSaveSpend(ch.channel, editingSpend.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveSpend(ch.channel, editingSpend.value) }}
                    autoFocus
                  />
                ) : (
                  <button
                    className="analytics-spend-btn"
                    onClick={() => setEditingSpend({ channel: ch.channel, value: ch.spend?.toString() ?? '0' })}
                  >
                    {ch.spend != null ? formatCurrency(ch.spend) : 'Set'}
                  </button>
                )}
              </span>
              <span className="analytics-channel-num analytics-cac" style={ch.cac != null ? { color: ch.cac > 50 ? 'var(--color-negative-primary)' : 'var(--color-positive-primary)' } : undefined}>
                {ch.cac != null ? formatCurrency(ch.cac) : '--'}
              </span>
            </div>
          ))}
        </div>
        {sorted.length === 0 && <div className="analytics-empty">No channel data yet. Events will appear once tracking is live.</div>}

        <div className="analytics-section-title" style={{ marginTop: 'var(--space-xl)' }}>Channel Mix</div>
        {renderChannelMix(sorted)}
      </div>
    )
  }

  function renderChannelMix(channels: ChannelMetrics[]) {
    const totalRegs = channels.reduce((s, c) => s + c.registrations, 0)
    if (totalRegs === 0) return <div className="analytics-empty">No registrations yet</div>

    return (
      <div className="analytics-channel-mix">
        <div className="analytics-mix-bar">
          {channels.filter(c => c.registrations > 0).map(c => (
            <div
              key={c.channel}
              className="analytics-mix-segment"
              style={{
                width: `${(c.registrations / totalRegs) * 100}%`,
                background: channelColor(c.channel),
              }}
              title={`${channelLabel(c.channel)}: ${c.registrations} (${formatPct((c.registrations / totalRegs) * 100)})`}
            />
          ))}
        </div>
        <div className="analytics-mix-legend">
          {channels.filter(c => c.registrations > 0).map(c => (
            <div key={c.channel} className="analytics-mix-item">
              <span className="analytics-channel-dot" style={{ background: channelColor(c.channel) }} />
              <span>{channelLabel(c.channel)}</span>
              <span className="analytics-mix-pct">{formatPct((c.registrations / totalRegs) * 100)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderCohorts() {
    if (!data) return null
    const { cohorts } = data

    if (cohorts.length === 0) {
      return (
        <div>
          <div className="analytics-section-title">Weekly Cohort Retention</div>
          <div className="analytics-empty">No cohort data yet. Retention data will appear after users register and return over multiple weeks.</div>
        </div>
      )
    }

    const maxWeeks = Math.max(...cohorts.map(c => c.retention.length), 0)

    return (
      <div>
        <div className="analytics-section-title">Weekly Cohort Retention</div>
        <div className="analytics-cohort-scroll">
          <table className="analytics-cohort-table">
            <thead>
              <tr>
                <th>Cohort</th>
                <th>Users</th>
                {Array.from({ length: maxWeeks }, (_, i) => (
                  <th key={i}>W{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map(row => (
                <tr key={row.cohort_week}>
                  <td className="analytics-cohort-week">{row.cohort_week}</td>
                  <td className="analytics-cohort-users">{row.total_users}</td>
                  {row.retention.map((pct, i) => (
                    <td
                      key={i}
                      className="analytics-cohort-cell"
                      style={{
                        background: retentionBg(pct),
                        color: retentionColor(pct),
                      }}
                    >
                      {pct}%
                    </td>
                  ))}
                  {/* Pad empty cells */}
                  {Array.from({ length: maxWeeks - row.retention.length }, (_, i) => (
                    <td key={`pad-${i}`} className="analytics-cohort-cell analytics-cohort-empty" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <button className="analytics-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="analytics-title">Analytics</h1>
      </div>

      {/* Date range picker */}
      <div className="analytics-range-picker">
        {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
          <button
            key={r}
            className={`analytics-range-btn ${dateRange === r ? 'active' : ''}`}
            onClick={() => setDateRange(r)}
          >
            {r === 'all' ? 'All' : r}
          </button>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="analytics-tabs">
        {([
          ['overview', 'Overview'],
          ['funnel', 'Funnel'],
          ['channels', 'Channels'],
          ['cohorts', 'Retention'],
        ] as [DashboardTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            className={`analytics-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="analytics-content">
        {loading ? (
          <div className="analytics-loading">
            <div className="analytics-spinner" />
            <span>Loading analytics...</span>
          </div>
        ) : !data ? (
          <div className="analytics-empty-state">
            <div className="analytics-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
              </svg>
            </div>
            <p>No analytics data yet</p>
            <p className="analytics-empty-sub">
              Run the SQL migration in Supabase to create the analytics tables, then data will start flowing automatically.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'funnel' && renderFunnel()}
            {activeTab === 'channels' && renderChannels()}
            {activeTab === 'cohorts' && renderCohorts()}
          </>
        )}
      </div>

      {/* Setup instructions */}
      <div className="analytics-setup-note">
        <details>
          <summary>Setup Instructions</summary>
          <ol>
            <li>Run <code>analytics-schema.sql</code> in Supabase SQL editor</li>
            <li>Replace <code>GA_MEASUREMENT_ID</code> in index.html with your Google Analytics ID</li>
            <li>Add Google Ads conversion ID if running Google Ads</li>
            <li>Meta Pixel is already active (ID: 840050529907859)</li>
            <li>Add UTM parameters to your ad URLs: <code>?utm_source=facebook&utm_medium=cpc&utm_campaign=launch</code></li>
          </ol>
        </details>
      </div>
    </div>
  )
}
