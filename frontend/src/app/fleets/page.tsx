'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Fleet, FleetStatus } from '@/types';

const STATUS_META: Record<FleetStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  Expected:   { label: 'Expected',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  dot: 'bg-amber-400'  },
  Arrived:    { label: 'Arrived',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-300',   dot: 'bg-blue-500'   },
  Unloading:  { label: 'Unloading',  color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500' },
  Reconciled: { label: 'Reconciled', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  dot: 'bg-green-500'  },
};

const FILTERS: (FleetStatus | 'All')[] = ['All', 'Expected', 'Arrived', 'Unloading', 'Reconciled'];

export default function FleetsPage() {
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [filter, setFilter] = useState<FleetStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api.getFleets();
      setFleets(data.results);
    } catch {
      setError('Failed to load fleets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleMarkArrived(id: string) {
    setActionLoading(id + ':arrived');
    setError('');
    try {
      const updated = await api.markArrived(id);
      setFleets(prev => prev.map(f => f.fleet_id === id ? updated : f));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStartUnloading(id: string) {
    setActionLoading(id + ':unload');
    setError('');
    try {
      const updated = await api.startUnloading(id);
      setFleets(prev => prev.map(f => f.fleet_id === id ? updated : f));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
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
          <p className="text-sm text-slate-500 mt-0.5">Track incoming fleets and manage their status</p>
        </div>
        <button
          onClick={load}
          className="text-sm text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_META) as FleetStatus[]).map(s => {
          const meta = STATUS_META[s];
          const count = fleets.filter(f => f.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? 'All' : s)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                filter === s ? `${meta.bg} ${meta.border}` : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                <span className={`text-xs font-semibold ${filter === s ? meta.color : 'text-slate-500'}`}>{s}</span>
              </div>
              <p className={`text-2xl font-bold ${filter === s ? meta.color : 'text-slate-700'}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-fit">
        {FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filter === s
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {s} {counts[s] > 0 && <span className="text-xs opacity-60">({counts[s]})</span>}
          </button>
        ))}
      </div>

      {/* Fleet list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Loading fleets...</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No fleets with status "{filter}"
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(fleet => {
            const meta = STATUS_META[fleet.status];
            return (
              <div
                key={fleet.fleet_id}
                className={`bg-white rounded-xl border-2 p-5 transition-all ${meta.border}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-lg">🚚</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-mono font-bold text-slate-900 text-base">{fleet.fleet_id}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                          {fleet.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">Origin: <span className="font-medium text-slate-700">{fleet.origin_hub}</span></p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>📦 <span className="font-semibold text-slate-600">{fleet.box_count}</span> boxes</span>
                        <span>🕐 Arrived {new Date(fleet.arrival_timestamp).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4 flex-shrink-0">
                    {fleet.status === 'Expected' && (
                      <button
                        onClick={() => handleMarkArrived(fleet.fleet_id)}
                        disabled={actionLoading === fleet.fleet_id + ':arrived'}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === fleet.fleet_id + ':arrived' ? 'Updating...' : 'Mark Arrived'}
                      </button>
                    )}
                    {fleet.status === 'Arrived' && (
                      <button
                        onClick={() => handleStartUnloading(fleet.fleet_id)}
                        disabled={actionLoading === fleet.fleet_id + ':unload'}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === fleet.fleet_id + ':unload' ? 'Updating...' : 'Start Unloading'}
                      </button>
                    )}
                    {fleet.status === 'Unloading' && (
                      <span className="text-xs text-orange-600 font-medium px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-200">
                        ⟳ In Progress
                      </span>
                    )}
                    {fleet.status === 'Reconciled' && (
                      <span className="text-xs text-green-600 font-medium px-3 py-1.5 bg-green-50 rounded-lg border border-green-200">
                        ✓ Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar for unloading fleets */}
                {fleet.status === 'Unloading' && fleet.box_count > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Unloading progress</span>
                      <span>{fleet.box_count} boxes total</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-orange-400 w-1/2" />
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
