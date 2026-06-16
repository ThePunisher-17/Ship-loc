DC = docker compose

# ── Lifecycle ────────────────────────────────────────────────────────────────

start:
	$(DC) up -d
	@echo "Services running:"
	@echo "  Frontend → http://localhost:3000"
	@echo "  Backend  → http://localhost:8000/api/v1"
	@echo "  Admin    → http://localhost:8000/admin"

up:
	$(DC) up --build -d

down:
	$(DC) down

restart:
	$(DC) restart

logs:
	$(DC) logs -f

logs-backend:
	$(DC) logs -f backend

logs-frontend:
	$(DC) logs -f frontend

# ── Database ─────────────────────────────────────────────────────────────────

migrate:
	$(DC) exec backend python manage.py makemigrations
	$(DC) exec backend python manage.py migrate

seed:
	$(DC) exec backend python manage.py seed_db

reseed:
	$(DC) exec backend python manage.py seed_db --flush

superuser:
	$(DC) exec backend python manage.py createsuperuser

# ── Setup (run once after clone) ─────────────────────────────────────────────

setup: up
	@echo "Waiting for DB to be ready..."
	@sleep 8
	$(DC) exec backend python manage.py makemigrations core
	$(DC) exec backend python manage.py migrate
	$(DC) exec backend python manage.py seed_db
	@echo ""
	@echo "Done. Open http://localhost:3000"

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	$(DC) down -v --remove-orphans

rebuild:
	$(DC) down
	$(DC) up --build -d

# ── Shell access ──────────────────────────────────────────────────────────────

shell-backend:
	$(DC) exec backend bash

shell-db:
	$(DC) exec db psql -U warehouse_admin -d warehouse_core

.PHONY: start up down restart logs logs-backend logs-frontend \
        migrate seed reseed superuser setup clean rebuild \
        shell-backend shell-db
