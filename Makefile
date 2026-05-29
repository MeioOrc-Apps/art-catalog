.PHONY: test lint up down smoke e2e

test:
	cd backend && uv run pytest
	cd frontend && npm run test

lint:
	cd backend && uv run ruff check .
	cd backend && uv run mypy src
	cd frontend && npm run lint

up:
	docker compose up -d

down:
	docker compose down

smoke:
	./scripts/smoke_phase0.sh

e2e:
	@echo "E2E tests postponed to post-MVP"
