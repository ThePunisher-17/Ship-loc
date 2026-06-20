# Ship-loc

A last-mile warehouse management system (WMS) for tracking shipment boxes from fleet arrival through driver dispatch. Built to solve TAT (Turnaround Time) visibility, race-condition-safe shelf assignment, and driver manifest ergonomics.

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend  | Django 4.2, Django REST Framework   |
| Database | PostgreSQL 14                       |
| Infra    | Docker Compose                      |

## Architecture

```
docker-compose.yml
├── warehouse_db        → PostgreSQL 14       (port 5432)
├── warehouse_backend   → Django REST API     (port 8000)
└── warehouse_frontend  → Next.js App Router  (port 3000)
```

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### First-Time Setup

```bash
make setup
```

This builds all containers, runs migrations, seeds sample data, and creates an admin superuser. Once complete:

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000/api/v1/
- **Admin Panel:** http://localhost:8000/admin/ (username: `admin`, password: `admin123`)

### Common Commands

| Command              | Description                          |
|----------------------|--------------------------------------|
| `make start`         | Start all services                   |
| `make down`          | Stop all services                    |
| `make restart`       | Restart all services                 |
| `make rebuild`       | Stop, rebuild images, and start      |
| `make logs`          | Tail logs from all services          |
| `make logs-backend`  | Tail backend logs only               |
| `make logs-frontend` | Tail frontend logs only              |
| `make migrate`       | Run Django makemigrations + migrate  |
| `make seed`          | Seed the database with sample data   |
| `make reseed`        | Flush and re-seed all data           |
| `make superuser`     | Create a Django superuser            |
| `make shell-backend` | Open a bash shell in the backend container |
| `make shell-db`      | Open a psql shell in the database    |
| `make clean`         | Stop services and remove volumes     |

## Data Model

| Model             | Primary Key          | Description                                        |
|-------------------|----------------------|----------------------------------------------------|
| `User`            | UUID                 | Roles: WarehouseStaff, Driver, Manager              |
| `Route`           | `route_id` (string)  | Delivery route with assigned driver                 |
| `PostalCodeMapping` | `postal_code`      | Maps postal codes to routes                         |
| `Location`        | `location_id` (string) | Shelf location (format: `Z-A-R04-S2`)            |
| `Fleet`           | `fleet_id` (string)  | Status: Expected &rarr; Arrived &rarr; Unloading &rarr; Reconciled |
| `Order`           | `order_id` (string)  | Customer order grouping shipment boxes              |
| `ShipmentBox`     | `tracking_number` (string) | Status: In-Transit &rarr; Unloaded &rarr; Stored &rarr; Retrieved &rarr; Dispatched |

### Design Highlights

- **Row-level locking** on shelf assignment using `select_for_update()` inside `transaction.atomic()` to prevent double-booking
- **TAT timestamps** on every state transition (`unloaded_at`, `stored_at`, `retrieved_at`, `dispatched_at`) for KPI tracking
- **Partial index** on open locations for fast shelf lookups

## API Endpoints

Base URL: `http://localhost:8000/api/v1/`

### CRUD Resources

| Prefix        | Resource       |
|---------------|----------------|
| `/users/`     | Users          |
| `/routes/`    | Routes         |
| `/locations/` | Shelf locations |
| `/fleets/`    | Fleets         |
| `/orders/`    | Orders         |
| `/boxes/`     | Shipment boxes |
| `/stats/`     | Dashboard stats |

### Custom Actions

**Fleet lifecycle:**
- `POST /fleets/{id}/mark_arrived/`
- `POST /fleets/{id}/start_unloading/`
- `POST /fleets/{id}/reconcile/` — blocks if boxes are still In-Transit or Unloaded

**Box scanning workflow:**
- `POST /boxes/scan_unload/` — marks box as Unloaded, returns sibling boxes
- `POST /boxes/scan_store/` — assigns shelf with row lock, suggests adjacent locations for siblings
- `POST /boxes/{id}/retrieve/` — moves Stored to Retrieved, frees shelf
- `POST /boxes/{id}/confirm_dispatch/` — moves Retrieved to Dispatched

**Driver manifest:**
- `GET /routes/{id}/manifest/` — all Stored + Retrieved boxes for a route in walk order

## Frontend Pages

| Route          | Description                                                    |
|----------------|----------------------------------------------------------------|
| `/`            | Dashboard with live stats, auto-refreshes every 30s, TAT alerts |
| `/fleets`      | Fleet pipeline with progress bars and Reconcile action          |
| `/scan`        | Two-step poka-yoke scan: box barcode then shelf barcode         |
| `/locations`   | Rack/shelf grid showing occupied slots                          |
| `/routes`      | Route list with color-coded direction icons                     |
| `/routes/[id]` | Driver manifest with boxes grouped by rack in walk order        |
| `/orders`      | Order list with search, status filter tabs, per-box status chips |
| `/users`       | Staff directory with role filter and driver-route assignment     |

## Project Structure

```
Ship-loc/
├── backend/
│   ├── core/                   # Django app
│   │   ├── models.py           # Data models
│   │   ├── views.py            # API views and custom actions
│   │   ├── serializers.py      # DRF serializers with computed fields
│   │   ├── urls.py             # API router
│   │   └── management/
│   │       └── commands/
│   │           └── seed_db.py  # Database seeder
│   ├── warehouse_project/      # Django project settings
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   ├── components/         # Shared UI components
│   │   ├── lib/                # API client, toast system, route colors
│   │   └── types/              # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── Makefile
```
