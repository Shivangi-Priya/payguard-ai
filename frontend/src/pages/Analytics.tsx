import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { endpoints } from '../lib/api'
import { useApiData } from '../lib/useApiData'
import { formatINR } from '../lib/format'
import { Loading, ErrorState, PageHeader } from '../components/Common'

const COLORS = {
  brand: '#4F7CFF',
  safe: '#2FD480',
  medium: '#F5C044',
  high: '#FF9640',
  critical: '#FF5470',
  dim: '#5C6488',
}

const RISK_COLORS = ['#2FD480', '#F5C044', '#FF9640', '#FF5470']

const tooltipStyle = {
  backgroundColor: '#10162A',
  border: '1px solid #232C4A',
  borderRadius: 8,
  color: '#E9ECF8',
  fontSize: 12,
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-semibold text-text mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function Analytics() {
  const { data, error, loading } = useApiData(endpoints.analytics, [], 8000)

  if (loading && !data) return <Loading label="Loading analytics" />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  return (
    <div>
      <PageHeader
        title="Fraud Analytics"
        sub="Aggregated view of agentic payment risk, fraud patterns, and merchant behaviour."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* GMV + Fraud Over Time */}
        <ChartCard title="Agentic GMV vs. Fraud Attempts">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.daily} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#232C4A" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="gmv" tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="fraud" orientation="right" tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(val, name) =>
                  name === 'GMV' ? formatINR(Number(val)) : val
                } />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8A93B8' }} />
              <Line yAxisId="gmv" type="monotone" dataKey="gmv" name="GMV" stroke={COLORS.brand} strokeWidth={2} dot={false} />
              <Line yAxisId="fraud" type="monotone" dataKey="fraud_attempts" name="Fraud attempts" stroke={COLORS.critical} strokeWidth={2} dot={false} />
              <Line yAxisId="fraud" type="monotone" dataKey="blocked" name="Blocked" stroke={COLORS.high} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Risk Distribution Pie */}
        <ChartCard title="Risk Score Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.risk_distribution}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {data.risk_distribution.map((_, idx) => (
                  <Cell key={idx} fill={RISK_COLORS[idx % RISK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#8A93B8' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status Distribution Bar */}
        <ChartCard title="Transaction Status Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.status_distribution} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#232C4A" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Transactions" radius={[4, 4, 0, 0]}>
                {data.status_distribution.map((entry, idx) => {
                  const colMap: Record<string, string> = {
                    APPROVED: COLORS.safe,
                    REVIEW: COLORS.medium,
                    HIGH_RISK: COLORS.high,
                    BLOCKED: COLORS.critical,
                  }
                  return <Cell key={idx} fill={colMap[entry.name] ?? COLORS.dim} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Merchant Risk Bar */}
        <ChartCard title="Merchant Risk Scores (Top 10)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.merchant_risk}
              layout="vertical"
              margin={{ top: 4, right: 20, bottom: 0, left: 90 }}
            >
              <CartesianGrid stroke="#232C4A" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="merchant" tick={{ fill: '#8A93B8', fontSize: 11 }} tickLine={false} axisLine={false} width={85} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="risk_score" name="Risk score" radius={[0, 4, 4, 0]}>
                {data.merchant_risk.map((entry, idx) => {
                  const col = entry.risk_score > 80 ? COLORS.critical : entry.risk_score > 60 ? COLORS.high : entry.risk_score > 30 ? COLORS.medium : COLORS.safe
                  return <Cell key={idx} fill={col} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Intent Mismatch Scatter */}
        <ChartCard title="Intent Match Score vs. Risk Score">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#232C4A" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="intent_match" name="Intent match" domain={[0, 100]}
                tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false}
                label={{ value: 'Intent Match →', position: 'insideBottomRight', offset: -4, fill: '#5C6488', fontSize: 10 }} />
              <YAxis type="number" dataKey="risk" name="Risk score" domain={[0, 100]}
                tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false}
                label={{ value: 'Risk ↑', angle: -90, position: 'insideLeft', offset: 8, fill: '#5C6488', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(val, name) => [val, String(name) === 'intent_match' ? 'Intent match' : 'Risk score']} />
              <Scatter data={data.intent_mismatch} fill={COLORS.brand} opacity={0.8} r={5}>
                {data.intent_mismatch.map((d, idx) => {
                  const col = d.risk > 80 ? COLORS.critical : d.risk > 60 ? COLORS.high : d.risk > 30 ? COLORS.medium : COLORS.safe
                  return <Cell key={idx} fill={col} />
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Velocity chart */}
        <ChartCard title="Transaction Velocity (Last Hour)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.velocity} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#232C4A" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fill: '#5C6488', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#5C6488', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="transactions" name="Transactions" fill={COLORS.brand} radius={[4, 4, 0, 0]} opacity={0.9} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
