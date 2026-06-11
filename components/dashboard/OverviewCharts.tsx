"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TimeSeriesPoint, SeverityCount } from "@/types";

interface OverviewChartsProps {
  timeData: TimeSeriesPoint[];
  severityData: SeverityCount[];
  totalSeverity: number;
}

export function OverviewCharts({ timeData, severityData, totalSeverity }: OverviewChartsProps) {
  const isTimeDataEmpty = timeData.length === 0 || timeData.every(p => p.low === 0 && p.medium === 0 && p.high === 0 && p.critical === 0);
  const isSeverityDataEmpty = totalSeverity === 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Line chart */}
      <div className="col-span-1 lg:col-span-2 rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
          Events over last 7 days
        </h3>
        <div className="h-[280px] flex items-center justify-center">
          {isTimeDataEmpty ? (
            <p className="text-sm text-[var(--muted)]">Gathering data — this chart populates as events arrive</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px" }}
                />
                <Line type="monotone" dataKey="low" stroke="#15803D" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="medium" stroke="#A16207" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="high" stroke="#C2410C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="critical" stroke="#B91C1C" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Donut chart */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
          Severity distribution
        </h3>
        <div className="h-[240px] relative flex items-center justify-center">
          {isSeverityDataEmpty ? (
            <p className="text-sm text-[var(--muted)]">No events yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--foreground)]">{totalSeverity}</p>
                  <p className="text-xs text-[var(--muted)]">Total</p>
                </div>
              </div>
            </>
          )}
        </div>
        {!isSeverityDataEmpty && (
          <div className="mt-2 flex flex-wrap gap-3 justify-center">
            {severityData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[var(--muted)]">{s.name}</span>
                <span className="font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
