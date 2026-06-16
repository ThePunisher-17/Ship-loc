'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getRouteColor } from '@/lib/routeColors';
import type { User, Route } from '@/types';

const ROLE_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  Manager:       { label: 'Manager',        color: 'text-blue-700',   bg: 'bg-blue-50',   dot: 'bg-blue-500'   },
  WarehouseStaff:{ label: 'Warehouse Staff', color: 'text-green-700',  bg: 'bg-green-50',  dot: 'bg-green-500'  },
  Driver:        { label: 'Driver',          color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-500' },
};

export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [routes, setRoutes]   = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<string>('All');

  useEffect(() => {
    Promise.all([api.getUsers(), api.getRoutes()])
      .then(([u, r]) => { setUsers(u.results); setRoutes(r.results); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const driverRouteMap = routes.reduce<Record<string, Route>>((acc, r) => {
    if (r.assigned_driver) acc[r.assigned_driver] = r;
    return acc;
  }, {});

  const roles = ['All', 'Manager', 'WarehouseStaff', 'Driver'];
  const visible = filter === 'All' ? users : users.filter(u => u.role === filter);

  const grouped = {
    Manager:        users.filter(u => u.role === 'Manager'),
    WarehouseStaff: users.filter(u => u.role === 'WarehouseStaff'),
    Driver:         users.filter(u => u.role === 'Driver'),
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Staff Directory</h1>
        <p className="text-sm text-slate-500 mt-0.5">All users, roles, and driver route assignments</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(Object.entries(ROLE_META)).map(([role, meta]) => (
          <div key={role} className={`rounded-xl border-2 p-4 ${filter === role ? `${meta.bg} border-current` : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
            </div>
            <p className={`text-2xl font-bold ${meta.color}`}>{grouped[role as keyof typeof grouped]?.length ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-slate-200 p-1 rounded-lg w-fit">
        {roles.map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filter === r ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {r === 'WarehouseStaff' ? 'Staff' : r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Loading staff…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(user => {
            const meta = ROLE_META[user.role];
            const assignedRoute = user.role === 'Driver' ? driverRouteMap[user.user_id] : null;
            const routeColor = assignedRoute ? getRouteColor(assignedRoute.route_id) : null;
            return (
              <div key={user.user_id} className={`bg-white rounded-xl border-2 p-4 ${user.active_status ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${meta.bg} ${meta.color} font-bold text-base flex items-center justify-center flex-shrink-0`}>
                    {user.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{user.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      {!user.active_status && <span className="text-xs text-slate-400 ml-1">(inactive)</span>}
                    </div>
                  </div>
                </div>

                {assignedRoute && routeColor && (
                  <div className={`${routeColor.bg} border ${routeColor.border} rounded-lg px-3 py-2 mt-2`}>
                    <p className="text-xs text-slate-400 mb-0.5">Assigned Route</p>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${routeColor.text}`}>{routeColor.icon}</span>
                      <span className={`text-sm font-semibold ${routeColor.text}`}>{assignedRoute.route_name}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{assignedRoute.route_id}</p>
                    {assignedRoute.box_counts && (
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className={`font-semibold ${routeColor.text}`}>{assignedRoute.box_counts.stored} stored</span>
                        <span className="text-slate-400">{assignedRoute.box_counts.dispatched} dispatched</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="font-mono text-xs text-slate-300 mt-3 truncate">{user.user_id}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
