# VoltQuest developer shortcuts. `make help` lists the targets.
.DEFAULT_GOAL := help
.PHONY: help install dev dev-backend dev-frontend test test-frontend test-backend test-hpc-native lint build check up up-lite down logs clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install frontend and backend dependencies
	cd frontend && npm ci
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -r backend/requirements.txt

dev: ## Run API and web client together (http://localhost:5173)
	./scripts/dev.sh

dev-backend: ## Run only the API with autoreload
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-frontend: ## Run only the Vite dev server
	cd frontend && npx vite

test: test-frontend test-backend ## Run all tests

test-frontend: ## Run vitest
	cd frontend && npx vitest run

test-backend: ## Run pytest
	cd backend && .venv/bin/python -m pytest -q

test-hpc-native: ## Compile and run HPC C17/C++17 examples (OpenMP and MPI required)
	node scripts/check-hpc-native.mjs --parallel

lint: ## Lint the frontend
	cd frontend && npx eslint src

build: ## Production build of the web client
	cd frontend && npx vite build

check: ## Full gate: lint + tests + build + payload budget + backend tests
	./scripts/check.sh

up: ## Start the full stack in Docker (http://localhost:8080)
	docker compose up --build

up-lite: ## Start the SQLite-only stack in Docker
	docker compose -f docker-compose.lite.yml up --build

down: ## Stop and remove the Docker stack
	docker compose down
	docker compose -f docker-compose.lite.yml down 2>/dev/null || true

logs: ## Tail Docker logs
	docker compose logs -f --tail=100

clean: ## Remove build output and caches
	rm -rf frontend/dist frontend/node_modules/.vite backend/voltquest.db
	find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
