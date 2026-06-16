export type UserRole = 'WarehouseStaff' | 'Driver' | 'Manager';

export interface User {
  user_id: string;
  full_name: string;
  role: UserRole;
  active_status: boolean;
}

export interface PostalCodeMapping {
  postal_code: string;
  route: string;
}

export interface Route {
  route_id: string;
  route_name: string;
  assigned_driver: string | null;
  assigned_driver_name: string | null;
  postal_codes: string[];
  box_counts: {
    total: number;
    in_transit: number;
    unloaded: number;
    stored: number;
    retrieved: number;
    dispatched: number;
  };
}

export interface Location {
  location_id: string;
  zone: string;
  rack: string;
  shelf: string;
  is_occupied: boolean;
  weight_capacity_kg: string;
  current_box: {
    tracking_number: string;
    order: string;
    route: string;
    box_sequence: string;
  } | null;
}

export type FleetStatus = 'Expected' | 'Arrived' | 'Unloading' | 'Reconciled';

export interface Fleet {
  fleet_id: string;
  origin_hub: string;
  status: FleetStatus;
  arrival_timestamp: string;
  box_count: number;
  in_transit_count: number;
  unloaded_count: number;
  stored_count: number;
  dispatched_count: number;
  unload_progress: number;
}

export interface Order {
  order_id: string;
  total_boxes: number;
  delivery_address: string;
  order_date: string;
  stored_count: number;
  dispatched_count: number;
  box_statuses: {
    tracking_number: string;
    status: string;
    location__location_id: string | null;
    route_id: string | null;
    box_sequence: string;
  }[];
}

export type BoxStatus = 'In-Transit' | 'Unloaded' | 'Stored' | 'Retrieved' | 'Dispatched';

export interface ShipmentBox {
  tracking_number: string;
  fleet: string;
  order: string;
  route: string | null;
  location: string | null;
  location_label: string | null;
  box_sequence: string;
  status: BoxStatus;
  order_total_boxes: number;
  order_address: string;
  unloaded_at: string | null;
  stored_at: string | null;
  retrieved_at: string | null;
  dispatched_at: string | null;
  minutes_unloaded: number | null;
}

export interface ScanUnloadResponse {
  box: ShipmentBox;
  order_total_boxes: number;
  siblings: ShipmentBox[];
}

export interface ScanStoreResponse {
  box: ShipmentBox;
  suggested_sibling_locations: string[];
}

export interface Stats {
  box_counts: Record<string, number>;
  fleet_counts: Record<string, number>;
  avg_wait_minutes: number | null;
  zone_capacity: { zone: string; total: number; occupied: number }[];
  total_boxes: number;
  total_locations: number;
  free_locations: number;
}
