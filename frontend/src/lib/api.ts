import type { Fleet, ShipmentBox, Location, Route, ScanUnloadResponse, ScanStoreResponse } from '@/types';

const BASE =
  (typeof window === 'undefined'
    ? process.env.INTERNAL_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:8000/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Fleets
  getFleets: () => request<{ results: Fleet[] }>('/fleets/'),
  getFleet: (id: string) => request<Fleet>(`/fleets/${id}/`),
  markArrived: (id: string) => request<Fleet>(`/fleets/${id}/mark_arrived/`, { method: 'POST' }),
  startUnloading: (id: string) => request<Fleet>(`/fleets/${id}/start_unloading/`, { method: 'POST' }),

  // Boxes
  getBoxes: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: ShipmentBox[] }>(`/boxes/${qs}`);
  },
  scanUnload: (tracking_number: string) =>
    request<ScanUnloadResponse>('/boxes/scan_unload/', {
      method: 'POST',
      body: JSON.stringify({ tracking_number }),
    }),
  scanStore: (tracking_number: string, scanned_location_id: string, staff_user_id: string) =>
    request<ScanStoreResponse>('/boxes/scan_store/', {
      method: 'POST',
      body: JSON.stringify({ tracking_number, scanned_location_id, staff_user_id }),
    }),
  dispatch: (tracking_number: string) =>
    request<ShipmentBox>(`/boxes/${tracking_number}/confirm_dispatch/`, { method: 'POST' }),

  // Locations
  getLocations: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ results: Location[] }>(`/locations/${qs}`);
  },

  // Routes
  getRoutes: () => request<{ results: Route[] }>('/routes/'),
  getRouteManifest: (id: string) => request<ShipmentBox[]>(`/routes/${id}/manifest/`),
};
