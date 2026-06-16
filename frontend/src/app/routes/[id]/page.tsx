'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getRouteColor } from '@/lib/routeColors';
import type { Route, ShipmentBox } from '@/types';

type GroupedRack = {
  rackLabel: string;
  boxes: ShipmentBox[];
};

function groupByRack(boxes: ShipmentBox[]): GroupedRack[] {
  const map = new Map<string, ShipmentBox[]>();
  for (const box of boxes) {
    const rack = box.location_label?.split('-').slice(0, 3).join('-') ?? 'Unassigned';
    if (!map.has(rack)) map.set(rack, []);
    map.get(rack)!.push(box);
  }
  // Sort by rack label, then sort boxes within each rack by shelf
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rackLabel, rackBoxes]) => ({
      rackLabel,
      boxes: rackBoxes.sort((a, b) =>
        (a.location_label ?? '').localeCompare(b.location_label ?? '')
      ),
    }));
}

export default function ManifestPage() {
  const { id } = useParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [boxes, setBoxes] = useState<ShipmentBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const color = getRouteColor(id);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [routesData, allBoxes] = await Promise.all([
        api.getRoutes(),
        api.getBoxes({ route_id: id }),
      ]);
      const found = routesData.results.find(r => r.route_id === id) ?? null;
      setRoute(found);
      setBoxes(allBoxes.results);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load manifest');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleRetrieve(tracking: string) {
    setActionLoading(tracking);
    setError('');
    try {
      const updated = await api.retrieve(tracking);
      setBoxes(prev => prev.map(b => b.tracking_number === tracking ? updated : b));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDispatch(tracking: string) {
    setActionLoading(tracking + ':dispatch');
    setError('');
    try {
      const updated = await api.dispatch(tracking);
      setBoxes(prev => prev.map(b => b.tracking_number === tracking ? updated : b));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  const storedBoxes  = boxes.filter(b => b.status === 'Stored');
  const retrievedBoxes = boxes.filter(b => b.status === 'Retrieved');
  const dispatchedBoxes = boxes.filter(b => b.status === 'Dispatched');
  const visibleBoxes = filter === 'pending'
    ? boxes.filter(b => b.status === 'Stored' || b.status === 'Retrieved')
    : boxes;

  const grouped = groupByRack(visibleBoxes.filter(b => b.status === 'Stored' || b.status === 'Retrieved'));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <a href="/routes" className="text-slate-400 hover:text-slate-700 text-sm">← Routes</a>
      </div>

      <div className={`rounded-xl border-2 ${color.border} ${color.bg} p-5`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-slate-800 text-white text-2xl font-bold flex items-center justify-center`}>
              {color.icon}
            </div>
            <div>
              <h1 className={`text-xl font-bold ${color.text}`}>
                {route?.route_name ?? id}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Driver: <span className="font-medium text-slate-700">{route?.assigned_driver_name ?? 'Unassigned'}</span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="font-mono text-xs">{id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="text-sm text-slate-500 hover:text-slate-800 border border-slate-300 bg-white rounded-lg px-3 py-1.5"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Dispatch progress</span>
            <span className="font-medium">{dispatchedBoxes.length} / {boxes.length} boxes dispatched</span>
          </div>
          <div className="w-full bg-white/60 rounded-full h-2.5 flex overflow-hidden">
            <div
              className="h-2.5 bg-purple-500 transition-all"
              style={{ width: `${boxes.length > 0 ? (dispatchedBoxes.length / boxes.length) * 100 : 0}%` }}
            />
            <div
              className="h-2.5 bg-amber-400 transition-all"
              style={{ width: `${boxes.length > 0 ? (retrievedBoxes.length / boxes.length) * 100 : 0}%` }}
            />
            <div
              className="h-2.5 bg-green-400 transition-all"
              style={{ width: `${boxes.length > 0 ? (storedBoxes.length / boxes.length) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Stored: {storedBoxes.length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Retrieved: {retrievedBoxes.length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"/>Dispatched: {dispatchedBoxes.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-fit">
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pending ({storedBoxes.length + retrievedBoxes.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            All Boxes ({boxes.length})
          </button>
        </div>
        <p className="text-xs text-slate-400">Sorted by rack → shelf for efficient pickup</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Loading manifest...</div>
      ) : grouped.length === 0 && filter === 'pending' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="font-semibold text-slate-700">All boxes dispatched</p>
          <p className="text-sm text-slate-400 mt-1">Nothing left to retrieve for this route.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ rackLabel, boxes: rackBoxes }) => (
            <div key={rackLabel} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Rack header */}
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                  ⊞
                </div>
                <div>
                  <p className="font-mono font-bold text-slate-700 text-sm">{rackLabel}</p>
                  <p className="text-xs text-slate-400">{rackBoxes.length} box{rackBoxes.length > 1 ? 'es' : ''} in this rack</p>
                </div>
              </div>

              {/* Box rows */}
              <div className="divide-y divide-slate-50">
                {rackBoxes.map(box => {
                  const isRetrieved = box.status === 'Retrieved';
                  const isRetrieving = actionLoading === box.tracking_number;
                  const isDispatching = actionLoading === box.tracking_number + ':dispatch';

                  return (
                    <div
                      key={box.tracking_number}
                      className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors ${isRetrieved ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Shelf badge */}
                        <div className={`flex-shrink-0 w-16 h-10 rounded-lg border-2 flex flex-col items-center justify-center ${color.border} ${color.bg}`}>
                          <span className={`text-xs font-bold font-mono ${color.text}`}>
                            {box.location_label?.split('-').slice(-1)[0] ?? '?'}
                          </span>
                          <span className="text-xs text-slate-400">shelf</span>
                        </div>

                        {/* AWB + order info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono font-bold text-slate-800 text-sm">{box.tracking_number}</p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color.badge}`}>
                              {color.icon} {id.replace('RT-', '')}
                            </span>
                            {isRetrieved && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                                Retrieved
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                            <span>Order: <span className="font-mono text-slate-600">{box.order}</span></span>
                            <span>Seq: <span className="font-medium text-slate-600">{box.box_sequence}</span></span>
                            <span>of <span className="font-medium">{box.order_total_boxes}</span> boxes</span>
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex-shrink-0 ml-4">
                        {!isRetrieved ? (
                          <button
                            onClick={() => handleRetrieve(box.tracking_number)}
                            disabled={!!isRetrieving}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {isRetrieving ? '...' : 'Pick Up'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDispatch(box.tracking_number)}
                            disabled={!!isDispatching}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {isDispatching ? '...' : 'Dispatch'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Dispatched boxes (collapsed) */}
          {filter === 'all' && dispatchedBoxes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
                <span className="text-green-600 font-bold text-sm">✓ Dispatched ({dispatchedBoxes.length})</span>
              </div>
              <div className="divide-y divide-slate-50">
                {dispatchedBoxes.map(box => (
                  <div key={box.tracking_number} className="flex items-center justify-between px-5 py-3 opacity-50">
                    <div>
                      <p className="font-mono text-sm text-slate-600">{box.tracking_number}</p>
                      <p className="text-xs text-slate-400">Order {box.order} · {box.box_sequence}</p>
                    </div>
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Dispatched</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
