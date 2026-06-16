export type UserRole = 'WarehouseStaff' | 'Driver' | 'Manager';

export interface User {
  user_id: string;
  full_name: string;
  role: UserRole;
  active_status: boolean;
}

export interface Route {
  route_id: string;
  route_name: string;
  assigned_driver: string | null;
  assigned_driver_name: string | null;
}

export interface Location {
  location_id: string;
  zone: string;
  rack: string;
  shelf: string;
  is_occupied: boolean;
  weight_capacity_kg: string;
}

export type FleetStatus = 'Expected' | 'Arrived' | 'Unloading' | 'Reconciled';

export interface Fleet {
  fleet_id: string;
  origin_hub: string;
  status: FleetStatus;
  arrival_timestamp: string;
  box_count: number;
}

export interface Order {
  order_id: string;
  total_boxes: number;
  delivery_address: string;
  order_date: string;
  stored_count: number;
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
  unloaded_at: string | null;
  stored_at: string | null;
  dispatched_at: string | null;
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
