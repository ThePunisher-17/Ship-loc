import { api } from '@/lib/api';
import type { Location } from '@/types';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  let locations: Location[] = [];
  try {
    const data = await api.getLocations();
    locations = data.results;
  } catch {
    // backend not ready
  }

  const zones = Array.from(new Set(locations.map(l => l.zone))).sort();

  const byZone = Object.fromEntries(
    zones.map(zone => {
      const zoneLocs = locations.filter(l => l.zone === zone);
      const racks = Array.from(new Set(zoneLocs.map(l => l.rack))).sort((a, b) => Number(a) - Number(b));
      const shelves = Array.from(new Set(zoneLocs.map(l => l.shelf))).sort((a, b) => Number(a) - Number(b));
      const byRackShelf = Object.fromEntries(
        racks.map(rack => [
          rack,
          Object.fromEntries(
            shelves.map(shelf => {
              const loc = zoneLocs.find(l => l.rack === rack && l.shelf === shelf);
              return [shelf, loc ?? null];
            })
          ),
        ])
      );
      return [zone, { racks, shelves, byRackShelf }];
    })
  );

  const totalOccupied = locations.filter(l => l.is_occupied).length;
  const totalFree = locations.filter(l => !l.is_occupied).length;
  const totalCapacity = locations.reduce((sum, l) => sum + parseFloat(l.weight_capacity_kg), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Warehouse Locations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Physical shelf map — 3 zones × 4 racks × 5 shelves</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Shelves</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{locations.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Occupied</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{totalOccupied}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Available</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalFree}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Capacity</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{(totalCapacity / 1000).toFixed(1)}t</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
          <span>Free</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
          <span>Occupied</span>
        </div>
        <span className="text-slate-300">|</span>
        <span className="text-xs">Hover a cell to see its ID and capacity</span>
      </div>

      {/* Zone grids */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No locations seeded yet.
        </div>
      ) : (
        <div className="space-y-6">
          {zones.map(zone => {
            const { racks, shelves, byRackShelf } = byZone[zone];
            const zoneLocs = locations.filter(l => l.zone === zone);
            const zoneOccupied = zoneLocs.filter(l => l.is_occupied).length;
            const zonePct = Math.round((zoneOccupied / zoneLocs.length) * 100);
            const barColor = zonePct > 80 ? 'bg-red-500' : zonePct > 50 ? 'bg-amber-400' : 'bg-green-500';

            return (
              <div key={zone} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center text-sm">
                      {zone}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Zone {zone}</p>
                      <p className="text-xs text-slate-400">{zoneOccupied}/{zoneLocs.length} occupied · {zoneLocs.length - zoneOccupied} free</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${zonePct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-600 w-10 text-right">{zonePct}%</span>
                  </div>
                </div>

                {/* Grid: shelves (rows, top=S5 bottom=S1) × racks (columns) */}
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="text-xs text-slate-400 font-medium pr-2 pb-1 text-right w-8">Shelf</th>
                        {racks.map(rack => (
                          <th key={rack} className="text-xs text-slate-400 font-medium text-center pb-1 w-20">
                            R{String(rack).padStart(2, '0')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...shelves].reverse().map(shelf => (
                        <tr key={shelf}>
                          <td className="text-xs text-slate-400 font-medium pr-2 text-right">S{shelf}</td>
                          {racks.map(rack => {
                            const loc = byRackShelf[rack]?.[shelf];
                            if (!loc) return (
                              <td key={rack} className="w-20 h-9 rounded-lg bg-slate-50 border border-slate-100" />
                            );
                            return (
                              <td
                                key={rack}
                                title={`${loc.location_id} · ${loc.weight_capacity_kg}kg max`}
                                className={`w-20 h-9 rounded-lg border text-center cursor-default transition-all hover:scale-105 hover:shadow-sm ${
                                  loc.is_occupied
                                    ? 'bg-red-100 border-red-300'
                                    : 'bg-green-50 border-green-200 hover:bg-green-100'
                                }`}
                              >
                                <span className={`text-xs font-mono ${loc.is_occupied ? 'text-red-600' : 'text-green-700'}`}>
                                  {loc.location_id.split('-').slice(2).join('-')}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
