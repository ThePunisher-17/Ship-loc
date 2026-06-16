'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Stats, Fleet, ShipmentBox } from '@/types';

const REFRESH_INTERVAL = 30_000;

export default function DashboardPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [pending, setPending] = useState<ShipmentBox[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, f, b] = await Promise.all([
        api.getStats(),
        api.getFleets(),
        api.getBoxes({ status: 'Unloaded' }),
      ]);
      setStats(s);
      setFleets(f.results);
      setPending(b.results);
      setLastUpdated(new Date());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading dashboard…</div>
  );

  const bc = stats?.box_counts ?? {};
  const fc = stats?.fleet_counts ?? {};
  const totalBoxes = stats?.total_boxes ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operations Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refreshes every 30s`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.avg_wait_minutes != null && stats.avg_wait_minutes > 30 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-500">⚠</span>
              <span className="text-sm font-medium text-red-700">
                Avg wait: {stats.avg_wait_minutes}m — boxes need placement
              </span>
            </div>
          )}
          {pending.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-500">⚠</span>
              <span className="text-sm font-medium text-amber-700">
                {pending.length} box{pending.length > 1 ? 'es' : ''} awaiting placement
              </span>
            </div>
          )}
          <button onClick={load} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Active Fleets"   value={(fc['Expected'] ?? 0) + (fc['Arrived'] ?? 0) + (fc['Unloading'] ?? 0)} sub={`${Object.values(fc).reduce((a,b)=>a+b,0)} total`} accent="blue" />
        <StatCard label="In-Transit"      value={bc['In-Transit']  ?? 0} sub="en-route"           accent="slate"  />
        <StatCard label="Awaiting Shelf"  value={bc['Unloaded']    ?? 0} sub="need placement"      accent="orange" />
        <StatCard label="On Shelves"      value={bc['Stored']      ?? 0} sub="ready to dispatch"   accent="green"  />
        <StatCard label="Dispatched"      value={bc['Dispatched']  ?? 0} sub="out for delivery"    accent="purple" />
      </div>

      {/* Fleet pipeline + Zone capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FleetPipeline counts={fc} />
        <ZoneCapacity zones={stats?.zone_capacity ?? []} total={stats?.total_locations ?? 0} free={stats?.free_locations ?? 0} />
      </div>

      {/* Box breakdown + Pending placement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BoxBreakdown counts={bc} total={totalBoxes} />
        <PendingPlacement boxes={pending} />
      </div>

      {/* Fleet activity table */}
      <FleetActivity fleets={fleets} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub: string; accent: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', slate: 'text-slate-600', orange: 'text-orange-600', green: 'text-green-600', purple: 'text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[accent]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

const PIPELINE = [
  { status: 'Expected',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400'  },
  { status: 'Arrived',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500'   },
  { status: 'Unloading',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
  { status: 'Reconciled', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   dot: 'bg-green-500'  },
];

function FleetPipeline({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide">Fleet Pipeline</h2>
      <div className="flex gap-2 items-stretch">
        {PIPELINE.map(({ status, color, bg, dot }, i) => (
          <div key={status} className="flex items-center gap-2 flex-1">
            <div className={`flex-1 rounded-xl border p-4 text-center ${bg}`}>
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className={`text-xs font-semibold ${color}`}>{status}</span>
              </div>
              <p className={`text-3xl font-bold ${color}`}>{counts[status] ?? 0}</p>
            </div>
            {i < PIPELINE.length - 1 && <span className="text-slate-300 text-lg flex-shrink-0">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ZoneCapacity({ zones, total, free }: { zones: { zone: string; total: number; occupied: number }[]; total: number; free: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">Zone Capacity</h2>
        <span className="text-xs text-slate-400">{free}/{total} shelves free</span>
      </div>
      <div className="space-y-4">
        {zones.map(({ zone, total: t, occupied }) => {
          const pct = t > 0 ? Math.round((occupied / t) * 100) : 0;
          const bar = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-green-500';
          return (
            <div key={zone}>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center">{zone}</span>
                  <span className="text-sm text-slate-600">Zone {zone}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-slate-700">{pct}%</span>
                  <span className="text-xs text-slate-400 ml-2">{occupied}/{t}</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BOX_META = [
  { status: 'In-Transit', color: 'text-slate-600', bar: 'bg-slate-400' },
  { status: 'Unloaded',   color: 'text-orange-600',bar: 'bg-orange-400'},
  { status: 'Stored',     color: 'text-green-600', bar: 'bg-green-500' },
  { status: 'Retrieved',  color: 'text-amber-600', bar: 'bg-amber-400' },
  { status: 'Dispatched', color: 'text-purple-600',bar: 'bg-purple-500'},
];

function BoxBreakdown({ counts, total }: { counts: Record<string, number>; total: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide">Box Status</h2>
      <div className="space-y-3">
        {BOX_META.map(({ status, color, bar }) => {
          const count = counts[status] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={status}>
              <div className="flex justify-between mb-1">
                <span className={`text-xs font-medium ${color}`}>{status}</span>
                <span className="text-xs font-bold text-slate-700">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">{total} total</p>
      </div>
    </div>
  );
}

function PendingPlacement({ boxes }: { boxes: ShipmentBox[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:col-span-2">
      <h2 className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide flex items-center gap-2">
        Needs Shelf Placement
        {boxes.length > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">{boxes.length}</span>
        )}
      </h2>
      {boxes.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-slate-400 text-sm">✓ All unloaded boxes have been placed</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs border-b border-slate-100">
              <th className="pb-2 font-medium">Tracking #</th>
              <th className="pb-2 font-medium">Order</th>
              <th className="pb-2 font-medium">Route</th>
              <th className="pb-2 font-medium">Fleet</th>
              <th className="pb-2 font-medium text-right">Wait</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {boxes.map(box => (
              <tr key={box.tracking_number} className="hover:bg-slate-50">
                <td className="py-2 font-mono text-xs font-semibold text-slate-800">{box.tracking_number}</td>
                <td className="py-2 font-mono text-xs text-slate-600">{box.order}</td>
                <td className="py-2 text-xs text-slate-500">{box.route ?? '—'}</td>
                <td className="py-2 text-xs text-slate-500">{box.fleet}</td>
                <td className="py-2 text-right">
                  {box.minutes_unloaded != null ? (
                    <span className={`text-xs font-semibold ${box.minutes_unloaded > 30 ? 'text-red-600' : 'text-amber-600'}`}>
                      {box.minutes_unloaded}m
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FleetActivity({ fleets }: { fleets: Fleet[] }) {
  const badge: Record<string, string> = {
    Expected:   'bg-amber-100 text-amber-700',
    Arrived:    'bg-blue-100 text-blue-700',
    Unloading:  'bg-orange-100 text-orange-700',
    Reconciled: 'bg-green-100 text-green-700',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-700 mb-4 text-xs uppercase tracking-wide">Fleet Activity</h2>
      {fleets.length === 0 ? (
        <p className="text-slate-400 text-sm">No fleet data.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 text-xs border-b border-slate-100">
              <th className="pb-2 font-medium">Fleet ID</th>
              <th className="pb-2 font-medium">Origin Hub</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium text-center">Unload %</th>
              <th className="pb-2 font-medium text-right">Boxes</th>
              <th className="pb-2 font-medium">Arrived</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {fleets.map(fleet => (
              <tr key={fleet.fleet_id} className="hover:bg-slate-50">
                <td className="py-2.5 font-mono text-xs font-bold text-slate-800">{fleet.fleet_id}</td>
                <td className="py-2.5 text-slate-600">{fleet.origin_hub}</td>
                <td className="py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge[fleet.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {fleet.status}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-16 bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${fleet.unload_progress}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{fleet.unload_progress}%</span>
                  </div>
                </td>
                <td className="py-2.5 text-right font-semibold text-slate-700">{fleet.box_count}</td>
                <td className="py-2.5 text-xs text-slate-400">
                  {new Date(fleet.arrival_timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
