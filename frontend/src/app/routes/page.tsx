import { api } from '@/lib/api';
import { getRouteColor } from '@/lib/routeColors';
import type { Route, ShipmentBox } from '@/types';

export const dynamic = 'force-dynamic';

export default async function RoutesPage() {
  let routes: Route[] = [];
  let boxes: ShipmentBox[] = [];

  try {
    const [r, b] = await Promise.all([api.getRoutes(), api.getBoxes()]);
    routes = r.results;
    boxes = b.results;
  } catch {
    // backend not ready
  }

  const boxesByRoute = routes.reduce<Record<string, ShipmentBox[]>>((acc, r) => {
    acc[r.route_id] = boxes.filter(b => b.route === r.route_id);
    return acc;
  }, {});

  const totalDispatched = boxes.filter(b => b.status === 'Dispatched').length;
  const totalStored = boxes.filter(b => b.status === 'Stored').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Routes & Drivers</h1>
        <p className="text-sm text-slate-500 mt-0.5">Delivery routes with assigned drivers and box manifests</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Routes</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{routes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Boxes</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{boxes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Ready to Pick</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalStored}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Dispatched</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{totalDispatched}</p>
        </div>
      </div>

      {routes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No routes configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map(route => {
            const color = getRouteColor(route.route_id);
            const routeBoxes = boxesByRoute[route.route_id] ?? [];
            const stored = routeBoxes.filter(b => b.status === 'Stored').length;
            const retrieved = routeBoxes.filter(b => b.status === 'Retrieved').length;
            const dispatched = routeBoxes.filter(b => b.status === 'Dispatched').length;
            const inTransit = routeBoxes.filter(b => b.status === 'In-Transit').length;
            const hasDriver = !!route.assigned_driver_name;
            const pendingPickup = stored + retrieved;

            return (
              <div key={route.route_id} className={`bg-white rounded-xl border-2 ${color.border} p-5 hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 text-white text-xl font-bold flex items-center justify-center flex-shrink-0">
                      {color.icon}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{route.route_name}</p>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">{route.route_id}</p>
                    </div>
                  </div>
                  <a
                    href={`/routes/${route.route_id}`}
                    className={`text-xs font-semibold ${color.text} ${color.bg} border ${color.border} rounded-lg px-3 py-1.5 hover:opacity-80 transition-opacity flex items-center gap-1`}
                  >
                    {pendingPickup > 0 && (
                      <span className={`w-4 h-4 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold`}>
                        {pendingPickup}
                      </span>
                    )}
                    Open Manifest →
                  </a>
                </div>

                {/* Driver */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${hasDriver ? 'bg-slate-50' : 'bg-amber-50'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    hasDriver ? 'bg-slate-200 text-slate-600' : 'bg-amber-200 text-amber-700'
                  }`}>
                    {hasDriver ? route.assigned_driver_name!.charAt(0) : '?'}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${hasDriver ? 'text-slate-700' : 'text-amber-600'}`}>
                      {route.assigned_driver_name ?? 'Unassigned'}
                    </p>
                    <p className="text-xs text-slate-400">Driver</p>
                  </div>
                </div>

                {/* Box breakdown */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-slate-600">{inTransit}</p>
                    <p className="text-xs text-slate-400">In-Transit</p>
                  </div>
                  <div className={`${color.bg} rounded-lg p-2`}>
                    <p className={`text-lg font-bold ${color.text}`}>{stored}</p>
                    <p className="text-xs text-slate-400">Stored</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-amber-600">{retrieved}</p>
                    <p className="text-xs text-slate-400">Retrieved</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-purple-600">{dispatched}</p>
                    <p className="text-xs text-slate-400">Dispatched</p>
                  </div>
                </div>

                {/* Progress bar */}
                {routeBoxes.length > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Dispatch progress</span>
                      <span>{dispatched}/{routeBoxes.length} dispatched</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                      <div className="h-1.5 bg-purple-400" style={{ width: `${(dispatched / routeBoxes.length) * 100}%` }} />
                      <div className="h-1.5 bg-amber-400" style={{ width: `${(retrieved / routeBoxes.length) * 100}%` }} />
                      <div className={`h-1.5 ${color.dot}`} style={{ width: `${(stored / routeBoxes.length) * 100}%` }} />
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
