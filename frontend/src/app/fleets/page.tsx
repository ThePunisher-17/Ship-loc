'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { Fleet, FleetStatus } from '@/types';

const STATUS_META: Record<FleetStatus, { color: string; bg: string; border: string; dot: string }> = {
  Expected:   { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  dot: 'bg-amber-400'  },
  Arrived:    { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-300',   dot: 'bg-blue-500'   },
  Unloading:  { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500' },
  Reconciled: { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  dot: 'bg-green-500'  },
};

const FILTERS: (FleetStatus | 'All')[] = ['All', 'Expected', 'Arrived', 'Unloading', 'Reconciled'];

export default function FleetsPage() {
  const { toast } = useToast();
  const [fleets, setFleets]   = useState<Fleet[]>([]);
  const [filter, setFilter]   = useState<FleetStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.getFleets();
      setFleets(data.results);
    } catch { toast('Failed to load fleets', 'error'); }
    finally  { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, key: string, fn: () => Promise<Fleet>, label: string) {
    setBusy(id + ':' + key);
    try {
      const updated = await fn();
      setFleets(prev => prev.map(f => f.fleet_id === id ? updated : f));
      toast(label, 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally { setBusy(null); }
  }

  const counts = FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'All' ? fleets.length : fleets.filter(f => f.status === s).length;
    return acc;
  }, {});

  const visible = filter === 'All' ? fleets : fleets.filter(f => f.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fleet Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track incoming fleets and manage status transitions</p>
        </div>
        <button onClick={load} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
          ↻ Refresh
        </button>
      </div>

      {/* Status summary cards (clickable filters) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_META) as FleetStatus[]).map(s => {
          const m = STATUS_META[s];
          const count = fleets.filter(f => f.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? 'All' : s)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${filter === s ? `${m.bg} ${m.border}` : 'bg-white border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                <span className={`text-xs font-semibold ${filter === s ? m.color : 'text-slate-500'}`}>{s}</span>
              </div>
              <p className={`text-2xl font-bold ${filter === s ? m.color : 'text-slate-700'}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-fit">
        {FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {s} {counts[s] > 0 && <span className="text-xs opacity-60">({counts[s]})</span>}
          </button>
        ))}
      </div>

      {/* Fleet list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No fleets with status "{filter}"
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(fleet => {
            const m = STATUS_META[fleet.status];
            return (
              <div key={fleet.fleet_id} className={`bg-white rounded-xl border-2 ${m.border} p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0 text-lg`}>🚚</div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-mono font-bold text-slate-900">{fleet.fleet_id}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.bg} ${m.color}`}>{fleet.status}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">Origin: <span className="font-medium text-slate-700">{fleet.origin_hub}</span></p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                        <span>📦 <b className="text-slate-600">{fleet.box_count}</b> total</span>
                        <span>🚛 <b className="text-slate-500">{fleet.in_transit_count}</b> in-transit</span>
                        <span>📥 <b className="text-orange-600">{fleet.unloaded_count}</b> unloaded</span>
                        <span>🗄 <b className="text-green-600">{fleet.stored_count}</b> stored</span>
                        <span>✓ <b className="text-purple-600">{fleet.dispatched_count}</b> dispatched</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                    <p className="text-xs text-slate-400">
                      {new Date(fleet.arrival_timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {fleet.status === 'Expected' && (
                      <button disabled={busy === fleet.fleet_id + ':arrived'} onClick={() => act(fleet.fleet_id, 'arrived', () => api.markArrived(fleet.fleet_id), 'Fleet marked as Arrived')}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                        {busy === fleet.fleet_id + ':arrived' ? '…' : 'Mark Arrived'}
                      </button>
                    )}
                    {fleet.status === 'Arrived' && (
                      <button disabled={busy === fleet.fleet_id + ':unload'} onClick={() => act(fleet.fleet_id, 'unload', () => api.startUnloading(fleet.fleet_id), 'Unloading started')}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                        {busy === fleet.fleet_id + ':unload' ? '…' : 'Start Unloading'}
                      </button>
                    )}
                    {fleet.status === 'Unloading' && (
                      <button disabled={busy === fleet.fleet_id + ':reconcile'} onClick={() => act(fleet.fleet_id, 'reconcile', () => api.reconcileFleet(fleet.fleet_id), 'Fleet reconciled ✓')}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                        {busy === fleet.fleet_id + ':reconcile' ? '…' : 'Reconcile Fleet'}
                      </button>
                    )}
                    {fleet.status === 'Reconciled' && (
                      <span className="text-xs text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">✓ Complete</span>
                    )}
                  </div>
                </div>

                {/* Real unloading progress bar */}
                {fleet.status === 'Unloading' && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>Unloading progress</span>
                      <span className="font-semibold text-slate-600">{fleet.unload_progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden">
                      <div className="h-2 bg-green-500" style={{ width: `${fleet.stored_count / Math.max(fleet.box_count, 1) * 100}%` }} />
                      <div className="h-2 bg-orange-400" style={{ width: `${fleet.unloaded_count / Math.max(fleet.box_count, 1) * 100}%` }} />
                    </div>
                    <div className="flex gap-4 mt-1.5 text-xs">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Unloaded: {fleet.unloaded_count}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Stored: {fleet.stored_count}</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/>Pending: {fleet.in_transit_count}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
