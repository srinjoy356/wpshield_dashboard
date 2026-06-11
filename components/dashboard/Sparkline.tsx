"use client";

import { ResponsiveContainer, Line, LineChart } from "recharts";

interface SparklineProps {
  data: { value: number }[];
}

export function Sparkline({ data }: SparklineProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-4 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--foreground)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
