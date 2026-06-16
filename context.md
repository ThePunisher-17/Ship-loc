# Ship-loc — Project Context

Last updated: 2026-06-17

---

## What This Project Is

A last-mile warehouse management system (WMS) for tracking shipment boxes from fleet arrival through driver dispatch. Built to solve TAT (Turnaround Time) visibility, race-condition-safe shelf assignment, and driver manifest ergonomics.

**Stack:** Django 4.2 + DRF (backend) · Next.js 14 App Router (frontend) · PostgreSQL 14 · Docker Compose

---

## Architecture

```
docker-compose.yml
├── warehouse_db     → PostgreSQL 14, port 5432
├── warehouse_backend → Django, port 8000
└── warehouse_frontend → Next.js, port 3000
```

Backend base URL: `http://localhost:8000/api/v1/`  
Frontend: `http://localhost:3000`  
Admin: `http://localhost:8000/admin/` (admin / admin123)

DB credentials: `warehouse_admin` / `securepassword123` / DB: `warehouse_core`

---

## How to Run

```bash
make start        # docker compose up -d (prints URLs)
make setup        # full first-time setup: build + migrate + seed
make reseed       # flush and re-seed data
make down         # stop all services
make rebuild      # down + rebuild images
make shell-backend  # bash into backend container
make shell-db       # psql into postgres
```

---

## Data Model (`backend/core/models.py`)

### Key design decisions

- **`models.TextChoices`** — both `Fleet.Status` and `ShipmentBox.Status` are inner `TextChoices` classes, enforcing ORM-level integrity (typos in status strings become import errors, not silent data bugs).
- **`select_for_update()` inside `transaction.atomic()`** — shelf assignment issues a PostgreSQL `SELECT ... FOR UPDATE` row-lock, preventing two warehouse staff from double-booking the same shelf simultaneously.
- **TAT timestamps** — every state transition writes a timestamp (`unloaded_at`, `stored_at`, `retrieved_at`, `dispatched_at`) for KPI tracking.

### Models

| Model | PK | Notes |
|---|---|---|
| `User` | UUID | Roles: WarehouseStaff, Driver, Manager |
| `Route` | `route_id` (str) | FK to assigned Driver |
| `PostalCodeMapping` | `postal_code` | FK to Route |
| `Location` | `location_id` (str) | Format: `Z-A-R04-S2`. Partial index on open locations. |
| `Fleet` | `fleet_id` (str) | TextChoices: Expected→Arrived→Unloading→Reconciled |
| `Order` | `order_id` (str) | |
| `ShipmentBox` | `tracking_number` (str) | TextChoices: In-Transit→Unloaded→Stored→Retrieved→Dispatched |

### ShipmentBox FKs
- `fleet` → PROTECT
- `order` → PROTECT
- `route` → nullable, SET_NULL
- `location` → nullable, SET_NULL

### DB Indexes
- `idx_boxes_status` on `ShipmentBox.status`
- `idx_open_locations` on `(zone, rack, shelf)` WHERE `is_occupied=False`

---

## API Endpoints (`backend/core/urls.py`)

Router-registered ViewSets:

| Prefix | ViewSet |
|---|---|
| `/users/` | UserViewSet |
| `/routes/` | RouteViewSet |
| `/locations/` | LocationViewSet |
| `/fleets/` | FleetViewSet |
| `/orders/` | OrderViewSet |
| `/boxes/` | ShipmentBoxViewSet |
| `/stats/` | `stats` function-based view |

### Custom actions

**FleetViewSet:**
- `POST /fleets/{id}/mark_arrived/`
- `POST /fleets/{id}/start_unloading/`
- `POST /fleets/{id}/reconcile/` — guarded: blocks if any boxes still In-Transit or Unloaded

**ShipmentBoxViewSet:**
- `POST /boxes/scan_unload/` — marks box Unloaded, returns siblings
- `POST /boxes/scan_store/` — assigns shelf with `select_for_update()`, suggests adjacent locations for sibling boxes
- `POST /boxes/{id}/retrieve/` — Stored → Retrieved, frees shelf
- `POST /boxes/{id}/confirm_dispatch/` — Retrieved → Dispatched

**RouteViewSet:**
- `GET /routes/{id}/manifest/` — all Stored + Retrieved boxes for a route (driver picking list)

**Stats view (`/api/v1/stats/`)** returns: `box_counts`, `fleet_counts`, `avg_wait_minutes`, `zone_capacity`, `total_boxes`, `total_locations`, `free_locations`

---

## Serializers (`backend/core/serializers.py`)

All computed fields use `SerializerMethodField`:

| Serializer | Computed fields |
|---|---|
| `FleetSerializer` | `in_transit_count`, `unloaded_count`, `stored_count`, `dispatched_count`, `unload_progress` (%) |
| `ShipmentBoxSerializer` | `minutes_unloaded` (TAT — only when status=Unloaded), `order_address`, `location_label` |
| `LocationSerializer` | `current_box` (tracking/order/route of Stored box on that shelf) |
| `RouteSerializer` | `postal_codes` list, `box_counts` dict |
| `OrderSerializer` | `stored_count`, `dispatched_count`, `box_statuses` list |

`PAGE_SIZE: 200` set in DRF settings (was 50, which cut off locations).

---

## Frontend Pages (`frontend/src/app/`)

| Route | Component type | Description |
|---|---|---|
| `/` | `'use client'` | Dashboard — auto-refreshes every 30s, TAT alert when avg_wait > 30 min |
| `/fleets` | `'use client'` | Fleet pipeline with real progress bars and Reconcile action |
| `/scan` | `'use client'` | Two-step poka-yoke scan: box barcode → shelf barcode. Real staff picker. |
| `/locations` | Server Component | Rack/shelf grid showing occupied slots with current box info |
| `/routes` | Server Component | Route list with color-coded direction icons and pending box counts |
| `/routes/[id]` | `'use client'` | Driver manifest — boxes grouped by rack in walk order, Pick Up + Dispatch actions |
| `/orders` | `'use client'` | Order list with search, filter tabs (all/complete/partial/pending), per-box status chips |
| `/users` | `'use client'` | Staff directory with role filter, driver→route assignment with route colors |

---

## Key Frontend Files

### `frontend/src/lib/api.ts`
Environment-aware API base URL:
```typescript
const BASE = (typeof window === 'undefined'
    ? process.env.INTERNAL_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:8000/api/v1';
```
`INTERNAL_API_URL=http://backend:8000/api/v1` for SSR inside Docker.  
`NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` for browser calls.

### `frontend/src/lib/toast.tsx`
React Context toast system (`ToastProvider` + `useToast` hook). Types: success/error/info. Auto-dismiss 3500ms.

### `frontend/src/lib/routeColors.ts`
Route color mapping:
- `RT-NORTH` → blue (↑)
- `RT-SOUTH` → green (↓)
- `RT-EAST` → orange (→)
- `RT-WEST` → purple (←)

### `frontend/src/types/index.ts`
Full TypeScript interfaces: `User`, `Route`, `Location`, `Fleet`, `Order`, `ShipmentBox`, `Stats`

### `frontend/src/components/NavLink.tsx`
`'use client'` — uses `usePathname()` for active nav state.

---

## Critical Bugs Fixed During Development

| Bug | Root Cause | Fix |
|---|---|---|
| Dashboard showing all zeros | SSR fetches inside Next.js used `localhost:8000` which resolved to the container itself, not the backend | Added `INTERNAL_API_URL` + `typeof window === 'undefined'` check |
| 500 on all `/boxes/` requests | `@action` named `dispatch` overrode DRF's `APIView.dispatch()` — all requests hit `WSGIRequest` without DRF wrapping | Renamed action to `confirm_dispatch` with `url_path='confirm_dispatch'` |
| Only 50 of 60 locations returned | DRF `PAGE_SIZE` default was 50 | Set `PAGE_SIZE: 200` |
| Race condition on shelf assignment | `select_for_update()` was called before `transaction.atomic()`, so the lock was released immediately | Moved `.select_for_update().get()` inside the `with transaction.atomic():` block |
| Seeding failed with "relation does not exist" | No migrations existed for the `core` app | Ran `makemigrations core` to generate `0001_initial.py` |

---

## Docker Environment Variables

### Backend (`warehouse_backend`)
```
DATABASE_URL=postgresql://warehouse_admin:securepassword123@warehouse_db:5432/warehouse_core
SECRET_KEY=django-insecure-warehouse-dev-key-2024
DEBUG=True
```

### Frontend (`warehouse_frontend`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
INTERNAL_API_URL=http://backend:8000/api/v1
```

---

## Migrations

- `0001_initial.py` — full schema
- `0002_shipmentbox_retrieved_at.py` — adds `retrieved_at` field

---

## Seeder (`backend/core/management/commands/seed_db.py`)

Idempotent (`get_or_create`). Creates:
- 4 routes (RT-NORTH/SOUTH/EAST/WEST)
- Postal code mappings
- ~8 users (2 managers, 3 warehouse staff, 3 drivers)
- 60 locations across zones A/B/C
- 2–3 fleets
- Sample orders and shipment boxes across all statuses

---

## What's NOT Yet Done

- GitHub push (user asked but never provided a repo URL)
- No authentication/authorization on API endpoints (open access)
- No pagination UI on the frontend (all data loaded at once, `PAGE_SIZE=200`)
- No WebSocket/real-time push (dashboard polls every 30s instead)
