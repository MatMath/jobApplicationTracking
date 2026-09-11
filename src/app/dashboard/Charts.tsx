'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatShortDate } from '@/lib/date';
import { rate, type DashboardStats } from '@/lib/dashboard';

const tick = { fill: 'var(--viz-muted)', fontSize: 12 };

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-black/10 bg-[var(--background)] px-3 py-2 text-xs shadow-sm dark:border-white/10">
      {children}
    </div>
  );
}

/**
 * The tooltip is a convenience, never the only way to read a value, so every
 * chart carries this collapsible table with the same numbers.
 */
function TableView({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer opacity-60 hover:opacity-100">Show as table</summary>
      <table className="mt-2 w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`py-1 font-medium opacity-60 ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-t border-black/5 dark:border-white/5">
              {r.map((c, i) => (
                <td key={i} className={`py-1 ${i ? 'text-right' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Single series, so no legend: the section title names what is plotted. */
export function WeeklyChart({ data }: { data: DashboardStats['weekly'] }) {
  const rows = data.map((d) => ({ ...d, label: formatShortDate(d.week_start) }));

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              dataKey="label"
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ fill: 'var(--viz-cursor)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox>
                    <div className="opacity-60">Week of {payload[0].payload.label}</div>
                    <div className="font-medium">
                      {payload[0].value} application{payload[0].value === 1 ? '' : 's'}
                    </div>
                  </TooltipBox>
                ) : null
              }
            />
            <Bar dataKey="applications" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption="Applications per week"
        head={['Week of', 'Applications']}
        rows={rows.map((r) => [r.label, r.applications])}
      />
    </div>
  );
}

/**
 * Response rate per platform. The denominator rides next to every rate, because
 * "100%" from one application and "100%" from twenty are different claims.
 */
export function PlatformChart({ data }: { data: DashboardStats['by_platform'] }) {
  const rows = data.map((d) => ({
    ...d,
    pct: d.applied ? Math.round((d.responded / d.applied) * 100) : 0,
    tip: `${rate(d.responded, d.applied)} · ${d.responded} of ${d.applied}`,
  }));

  return (
    <div>
      <div style={{ height: Math.max(rows.length * 40 + 16, 96) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 96, bottom: 4, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="platform"
              tick={{ ...tick, fill: 'var(--foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              width={112}
            />
            <Tooltip
              cursor={{ fill: 'var(--viz-cursor)' }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox>
                    <div className="opacity-60">{payload[0].payload.platform}</div>
                    <div className="font-medium">{payload[0].payload.tip}</div>
                  </TooltipBox>
                ) : null
              }
            />
            <Bar dataKey="pct" fill="var(--series-1)" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {/* Bars take their value at the tip, in text ink - never the series colour. */}
              <LabelList dataKey="tip" position="right" style={{ fill: 'var(--foreground)', fontSize: 12 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView
        caption="Response rate by platform"
        head={['Platform', 'Applied', 'Replied', 'Rate']}
        rows={rows.map((r) => [r.platform, r.applied, r.responded, rate(r.responded, r.applied)])}
      />
    </div>
  );
}
