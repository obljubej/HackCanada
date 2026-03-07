SHELL := cmd.exe
.SHELLFLAGS := /C

.PHONY: help install build dev-backend dev-frontend test-backend test-frontend kill-node

help:
	@echo Available targets:
	@echo   make install        - Install backend and frontend dependencies
	@echo   make build          - Build backend and frontend
	@echo   make dev-backend    - Run backend dev server (port 5000)
	@echo   make dev-frontend   - Run frontend dev server (port 3000)
	@echo   make test-backend   - Type-check backend
	@echo   make test-frontend  - Build frontend (quick validation)
	@echo   make kill-node      - Kill all node.exe processes

install:
	npm --prefix backend install
	npm --prefix frontend install

build:
	npm --prefix backend run build
	npm --prefix frontend run build

dev-backend:
	npm --prefix backend run dev

dev-frontend:
	cd frontend && npm run dev

dev-all:
	cd backend && npm install
	cd frontend && npm install
	cd backend && npm run dev & \
	cd frontend && npm run dev

test-backend:
	npm --prefix backend exec -- npx tsc --noEmit

test-frontend:
	npm --prefix frontend run build

kill-node:
	taskkill /F /IM node.exe 2>nul

