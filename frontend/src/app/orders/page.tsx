'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getRouteColor } from '@/lib/routeColors';
import type { Order } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  'In-Transit': 'bg-slate-100 text-slate-600',
  'Unloaded':   'bg-orange-100 text-orange-700',
  'Stored':     'bg-green-100 text-green-700',
  'Retrieved':  'bg-amber-100 text-amber-700',
  'Dispatched': 'bg-purple-100 text-purple-700',
};

type Filter = 'all' | 'complete' | 'partial' | 'pending';

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.getOrders()
      .then(d => setOrders(d.results))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    const dispatched = o.dispatched_count;
    const total = o.total_boxes;
    if (filter === 'complete') return dispatched === total;
    if (filter === 'partial')  return dispatched > 0 && dispatched < total;
    if (filter === 'pending')  return dispatched === 0;
    return true;
  }).filter(o =>
    search === '' || o.order_id.toLowerCase().includes(search.toLowerCase()) || o.delivery_address.toLowerCase().includes(search.toLowerCase())
  );

  const complete = orders.filter(o => o.dispatched_count === o.total_boxes).length;
  const partial  = orders.filter(o => o.dispatched_count > 0 && o.dispatched_count < o.total_boxes).length;
  const pending  = orders.filter(o => o.dispatched_count === 0).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track delivery order completion status</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Orders', value: orders.length, color: 'text-slate-700' },
          { label: 'Complete',     value: complete,       color: 'text-green-600' },
          { label: 'Partial',      value: partial,        color: 'text-amber-600' },
          { label: 'Pending',      value: pending,        color: 'text-orange-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-200 p-1 rounded-lg">
          {(['all', 'complete', 'partial', 'pending'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f}
            </button>
          ))}
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search order ID or address…"
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">No orders found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const pct = order.total_boxes > 0 ? Math.round((order.dispatched_count / order.total_boxes) * 100) : 0;
            const isComplete = order.dispatched_count === order.total_boxes;
            return (
              <div key={order.order_id} className={`bg-white rounded-xl border-2 p-5 ${isComplete ? 'border-green-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-mono font-bold text-slate-800">{order.order_id}</p>
                      {isComplete && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Complete</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">📍 {order.delivery_address}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(order.order_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-slate-700">{pct}%</p>
                    <p className="text-xs text-slate-400">{order.dispatched_count}/{order.total_boxes} dispatched</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                  <div className={`h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>

                {/* Box list */}
                <div className="flex flex-wrap gap-2">
                  {order.box_statuses.map(b => {
                    const routeColor = b.route_id ? getRouteColor(b.route_id) : null;
                    return (
                      <div key={b.tracking_number} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="font-mono text-xs text-slate-700 font-semibold">{b.tracking_number}</span>
                        {routeColor && (
                          <span className={`text-xs font-semibold ${routeColor.text}`}>{routeColor.icon}</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${STATUS_STYLES[b.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {b.status}
                        </span>
                        {b.location__location_id && (
                          <span className="font-mono text-xs text-slate-400">{b.location__location_id}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
