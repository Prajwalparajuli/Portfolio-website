import { motion } from 'framer-motion'
import { NarrativeChart } from '@/types'
import { BarChart3 } from 'lucide-react'

const CHART_COLORS = [
  '#22d3ee', '#a78bfa', '#34d399', '#fb923c',
  '#f472b6', '#facc15', '#60a5fa', '#c084fc',
]

function formatValue(value: number, fmt?: string) {
  if (fmt === 'percent') return `${value}%`
  if (fmt === 'currency') return `$${value.toLocaleString()}`
  return value.toLocaleString()
}

/* ── Horizontal Bar Chart ── */
function HorizontalBarChart({ chart }: { chart: NarrativeChart }) {
  const maxVal = Math.max(...chart.data.map((d) => d.value))

  return (
    <div className="space-y-2">
      {chart.data.map((d, i) => {
        const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0
        const color = d.color || CHART_COLORS[i % CHART_COLORS.length]
        return (
          <div key={d.label} className="group">
            <div className="mb-0.5 flex items-baseline justify-between">
              <span className="text-xs text-foreground/80 truncate max-w-[60%]">{d.label}</span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {formatValue(d.value, chart.valueFormat)}
              </span>
            </div>
            <div className="h-5 w-full rounded-md bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-md"
                style={{ backgroundColor: color, minWidth: pct > 0 ? 4 : 0 }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Stacked Bar Chart ── */
function StackedBarChart({ chart }: { chart: NarrativeChart }) {
  const maxTotal = Math.max(...chart.data.map((d) => d.value + (d.value2 ?? 0)))
  const legend = chart.legend ?? ['Value 1', 'Value 2']

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
          <span className="text-[10px] text-muted-foreground">{legend[0]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
          <span className="text-[10px] text-muted-foreground">{legend[1]}</span>
        </div>
      </div>
      {/* Bars */}
      {chart.data.map((d, i) => {
        const total = d.value + (d.value2 ?? 0)
        const pctTotal = maxTotal > 0 ? (total / maxTotal) * 100 : 0
        const pctV1 = total > 0 ? (d.value / total) * 100 : 0
        return (
          <div key={d.label} className="group">
            <div className="mb-0.5 flex items-baseline justify-between">
              <span className="text-xs text-foreground/80 truncate max-w-[55%]">{d.label}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {d.value.toLocaleString()} / {(d.value2 ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="h-4 w-full rounded-md bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${pctTotal}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full rounded-md overflow-hidden"
              >
                <div className="h-full" style={{ width: `${pctV1}%`, backgroundColor: '#ef4444' }} />
                <div className="h-full flex-1" style={{ backgroundColor: '#22c55e' }} />
              </motion.div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Donut Chart ── */
function DonutChart({ chart }: { chart: NarrativeChart }) {
  const total = chart.data.reduce((s, d) => s + d.value, 0)
  const size = 160
  const strokeWidth = 22
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let accumulated = 0

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        {chart.data.map((d, i) => {
          const pct = total > 0 ? d.value / total : 0
          const dashLen = pct * circumference
          const dashOffset = -accumulated * circumference
          accumulated += pct
          const color = d.color || CHART_COLORS[i % CHART_COLORS.length]
          return (
            <motion.circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
            />
          )
        })}
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-2xl font-bold">
          {total.toLocaleString()}
        </text>
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[9px]">
          total
        </text>
      </svg>
      <div className="space-y-1.5 min-w-0">
        {chart.data.map((d, i) => {
          const color = d.color || CHART_COLORS[i % CHART_COLORS.length]
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
          return (
            <div key={d.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-foreground/80 truncate">{d.label}</span>
              <span className="ml-auto text-xs font-medium text-foreground tabular-nums">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Chart Renderer ── */
export function ChartRenderer({ chart }: { chart: NarrativeChart }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {chart.title}
        </h3>
      </div>
      {chart.type === 'horizontal-bar' && <HorizontalBarChart chart={chart} />}
      {chart.type === 'stacked-bar' && <StackedBarChart chart={chart} />}
      {chart.type === 'donut' && <DonutChart chart={chart} />}
      {chart.insight && (
        <p className="mt-3 border-t border-white/5 pt-2.5 text-xs leading-5 text-muted-foreground italic">
          {chart.insight}
        </p>
      )}
    </motion.div>
  )
}

/* ── Charts Grid: renders all charts for a project ── */
export function ChartsGrid({ charts }: { charts: NarrativeChart[] }) {
  if (charts.length === 0) return null
  const gridCols = charts.length === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'
  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {charts.map((chart) => (
        <ChartRenderer key={chart.title} chart={chart} />
      ))}
    </div>
  )
}
