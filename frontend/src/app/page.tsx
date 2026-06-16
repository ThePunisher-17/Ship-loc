import { api } from '@/lib/api';
import type { Fleet, ShipmentBox, Location } from '@/types';

export const dynamic = 'force-dynamic';

const FLEET_PIPELINE: { status: string; color: string; bg: string; dot: string }[] = [
  { status: 'Expected',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
  { status: 'Arrived',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500'  },
  { status: 'Unloading',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500'},
  { status: 'Reconciled', color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   dot: 'bg-green-500' },
];

const BOX_STATUSES: { status: string; label: string; color: string; bar: string }[] = [
  { status: 'In-Transit', label: 'In-Transit', color: 'text-slate-600', bar: 'bg-slate-400' },
  { status: 'Unloaded',   label: 'Unloaded',   color: 'text-blue-600',  bar: 'bg-blue-400'  },
  { status: 'Stored',     label: 'Stored',     color: 'text-green-600', bar: 'bg-green-500' },
  { status: 'Dispatched', label: 'Dispatched', color: 'text-purple-600',bar: 'bg-purple-500'},
];

export default async function DashboardPage() {
  let fleets: Fleet[] = [];
  let boxes: ShipmentBox[] = [];
  let locations: Location[] = [];

  try {
    const [f, b, l] = await Promise.all([
      api.getFleets(),
      api.getBoxes(),
      api.getLocations(),
    ]);
    fleets = f.results;
    boxes = b.results;
    locations = l.results;
  } catch {
    // backend not reachable
  }

  const statusCounts = boxes.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalBoxes = boxes.length;

  const zones = Array.from(new Set(locations.map(l => l.zone))).sort();
  const zoneStats = zones.map(zone => {
    const locs = locations.filter(l => l.zone === zone);
    const occupied = locs.filter(l => l.is_occupied).length;
    return { zone, total: locs.length, occupied, free: locs.length - occupied };
  });

  const pendingUnloaded = boxes.filter(b => b.status === 'Unloaded');
  const activeFleets = fleets.filter(f => f.status !== 'Reconciled');

  const fleetCounts = FLEET_PIPELINE.reduce<Record<string, number>>((acc, { status }) => {
    acc[status] = fleets.filter(f => f.status === status).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operations Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {pendingUnloaded.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <span className="text-amber-500 text-lg">⚠</span>
            <span className="text-sm font-medium text-amber-700">
              {pendingUnloaded.length} box{pendingUnloaded.length > 1 ? 'es' : ''} awaiting placement
            </span>
          </div>
        )}
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Active Fleets" value={activeFleets.length} sub={`${fleets.length} total`} accent="blue" />
        <StatCard label="In-Transit" value={statusCounts['In-Transit'] ?? 0} sub="boxes en-route" accent="slate" />
        <StatCard label="Unloaded" value={statusCounts['Unloaded'] ?? 0} sub="awaiting placement" accent="orange" />
        <StatCard label="Stored" value={statusCounts['Stored'] ?? 0} sub="on shelves" accent="green" />
        <StatCard label="Dispatched" value={statusCounts['Dispatched'] ?? 0} sub="out for delivery" accent="purple" />
      </div>

      {/* Middle row: Fleet pipeline + Zone capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fleet pipeline */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Fleet Pipeline</h2>
          <div className="flex gap-2 items-stretch">
            {FLEET_PIPELINE.map(({ status, color, bg, dot }, i) => (
              <div key={status} className="flex items-center gap-2 flex-1">
                <div className={`flex-1 rounded-xl border p-4 text-center ${bg}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className={`text-xs font-semibold ${color}`}>{status}</span>
                  </div>
                  <p className={`text-3xl font-bold ${color}`}>{fleetCounts[status] ?? 0}</p>
                </div>
                {i < FLEET_PIPELINE.length - 1 && (
                  <span className="text-slate-300 text-lg flex-shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Zone occupancy */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Zone Capacity</h2>
          <div className="space-y-4">
            {zoneStats.length === 0 ? (
              <p className="text-slate-400 text-sm">No location data</p>
            ) : zoneStats.map(({ zone, total, occupied, free }) => {
              const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-green-500';
              return (
                <div key={zone}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                        {zone}
                      </span>
                      <span className="text-sm text-slate-600">Zone {zone}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-700">{pct}%</span>
                      <span className="text-xs text-slate-400 ml-2">{occupied}/{total} shelves</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{free} shelves available</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Box status breakdown + Pending attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Box status breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:col-span-1">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Box Status</h2>
          <div className="space-y-3">
            {BOX_STATUSES.map(({ status, label, color, bar }) => {
              const count = statusCounts[status] ?? 0;
              const pct = totalBoxes > 0 ? Math.round((count / totalBoxes) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                    <span className="text-xs font-bold text-slate-700">{count} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">{totalBoxes} boxes total</p>
          </div>
        </div>

        {/* Pending unloaded boxes */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">
            Needs Placement
            {pendingUnloaded.length > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingUnloaded.length}
              </span>
            )}
          </h2>
          {pendingUnloaded.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
              ✓ All unloaded boxes have been placed
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 text-xs border-b border-slate-100">
                    <th className="pb-2 font-medium">Tracking #</th>
                    <th className="pb-2 font-medium">Order</th>
                    <th className="pb-2 font-medium">Route</th>
                    <th className="pb-2 font-medium">Fleet</th>
                    <th className="pb-2 font-medium">Seq</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pendingUnloaded.map(box => (
                    <tr key={box.tracking_number} className="hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs font-semibold text-slate-800">{box.tracking_number}</td>
                      <td className="py-2 font-mono text-xs text-slate-600">{box.order}</td>
                      <td className="py-2 text-xs text-slate-500">{box.route ?? '—'}</td>
                      <td className="py-2 text-xs text-slate-500">{box.fleet}</td>
                      <td className="py-2 text-xs text-slate-500">{box.box_sequence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent fleet activity */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Fleet Activity</h2>
        {fleets.length === 0 ? (
          <p className="text-slate-400 text-sm">No fleet data — backend may not be connected.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs border-b border-slate-100">
                <th className="pb-2 font-medium">Fleet ID</th>
                <th className="pb-2 font-medium">Origin Hub</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Boxes</th>
                <th className="pb-2 font-medium">Arrived</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fleets.map(fleet => (
                <tr key={fleet.fleet_id} className="hover:bg-slate-50">
                  <td className="py-2.5 font-mono text-xs font-bold text-slate-800">{fleet.fleet_id}</td>
                  <td className="py-2.5 text-slate-600">{fleet.origin_hub}</td>
                  <td className="py-2.5"><FleetBadge status={fleet.status} /></td>
                  <td className="py-2.5 text-right font-semibold text-slate-700">{fleet.box_count}</td>
                  <td className="py-2.5 text-xs text-slate-400">
                    {new Date(fleet.arrival_timestamp).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub: string;
  accent: 'blue' | 'slate' | 'orange' | 'green' | 'purple';
}) {
  const accents = {
    blue:   'text-blue-600 bg-blue-50',
    slate:  'text-slate-600 bg-slate-100',
    orange: 'text-orange-600 bg-orange-50',
    green:  'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accents[accent].split(' ')[0]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function FleetBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Expected:   'bg-amber-100 text-amber-700',
    Arrived:    'bg-blue-100 text-blue-700',
    Unloading:  'bg-orange-100 text-orange-700',
    Reconciled: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}
