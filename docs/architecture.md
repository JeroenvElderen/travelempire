# TravelEmpire architecture — initial foundation

## Product scope
Worldwide single-player taxi empire manager, developed incrementally from a reliable first playable taxi.

## UI
Vite + React + TypeScript, MapLibre GL, mobile-first navigation. The initial world view is deliberately a **preview**. It does not claim to offer dispatch, passenger generation, company creation or saving.

## Authoritative service (next milestone)
A TypeScript backend worker/API will own all game state mutations. The frontend will render snapshots and interpolate between server-provided positions. Never derive journey completion from animation or browser timers.

## Intended data layer
PostgreSQL + PostGIS for company entities, routes, road exploration, regional geometry and an append-only financial ledger. Supabase Auth for identity. WebSocket snapshots with versioned updates; polling fallback. No public credentials or server keys in client code.

## Core invariants
1. Each job has one authoritative state transition path.
2. Every payment is idempotent and linked to a completed job.
3. Vehicle location is derived from server-authoritative route progress.
4. Starting taxi uses exactly the same scheduler as every subsequent taxi.
5. Simulation restarts resume from persistent state, never browser state.
6. Exploration is awarded only for road segments actually traversed.
7. Significant features require tests before merging.

## Planned implementation order
1. UI/map preview and build verification.
2. Persistent company creation, player authentication and first free region.
3. A single server-driven taxi and valid road-following trip.
4. Stable automated dispatch, vehicle/driver lifecycle, money ledger.
5. Exploration, territory, demand, further business systems.

This document captures boundaries, not a claim that the backend exists.
