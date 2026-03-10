'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getPropertyPriceHistory } from '@/lib/api/client';
import { PriceHistoryResponse } from '@/lib/api/types';

interface PriceHistoryChartProps {
  propertyId: string;
  country?: string;
}

export function PriceHistoryChart({ propertyId, country = 'czech' }: PriceHistoryChartProps) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      try {
        const response = await getPropertyPriceHistory(propertyId, country);
        if (!cancelled) setData(response);
      } catch {
        // Silently fail - chart section just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [propertyId, country]);

  // Don't render if loading, no data, or only 1 data point (no history to show)
  if (loading || !data || data.history.length <= 1) return null;

  const chartData = data.history.map((entry) => ({
    date: new Date(entry.recorded_at).toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    }).replace(' ', " '"),
    price: entry.price / 1000,
    fullDate: new Date(entry.recorded_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    fullPrice: entry.price,
  }));

  const { summary } = data;
  const trendColor = summary.trend === 'up' ? 'text-red-600' : summary.trend === 'down' ? 'text-green-600' : 'text-gray-500';
  const trendLabel = summary.trend === 'up' ? 'Price Increased' : summary.trend === 'down' ? 'Price Decreased' : 'Stable';

  return (
    <div className="mb-8 bg-gray-50 rounded-2xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-gray-900">Price History</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black ${trendColor}`}>
            {summary.price_change_pct > 0 ? '+' : ''}{summary.price_change_pct}%
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase">{trendLabel}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceHistGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#84CC16" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#84CC16" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 700 }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 700 }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={false}
            tickFormatter={(value) => `${value}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 700,
            }}
            labelStyle={{ color: '#111827', fontWeight: 900 }}
            formatter={(_value: any, _name: any, props: any) => [
              `${props.payload.fullPrice.toLocaleString('cs-CZ')} K\u010D`,
              '',
            ]}
            labelFormatter={(_label: any, payload: any) =>
              payload && payload[0] ? payload[0].payload.fullDate : _label
            }
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#84CC16"
            strokeWidth={2}
            fill="url(#priceHistGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
