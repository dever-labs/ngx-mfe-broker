# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-16

### Changed
- `MfeStateService` no longer falls back to in-memory defaults when a key is missing from localStorage. Instead it uses a two-pass init: first writes shell-provided `initialState` values to localStorage (if not already present), then reads from localStorage exclusively.
- If a key is missing from localStorage in a browser environment after the init write, an error is thrown immediately — misconfiguration fails loudly rather than silently.
- SSR/non-browser environments (no localStorage) still use the provided `initialState` value directly.
- Removed unused `defaults` map from `MfeStateService`.
- Updated docs to reflect fail-fast semantics and shell ownership of initial values.

## [0.1.4] - 2026-07-16

### Changed
- State contract pattern: clarified that the contract is **shell-owned** — the shell team maintains it and reviews all change requests from MFE teams
- Defaults (`initialState`) are explicitly the shell's responsibility; the contract only exports the type shape and key names
- Updated diagram to show shell ownership; non-monorepo section updated accordingly

## [0.1.3] - 2026-07-16

### Changed
- State contract pattern in docs simplified: removed `APP_STATE_KEYS` entirely, `injectAppState` now derives keys from `APP_INITIAL_STATE` automatically — adding a key to the model wires it everywhere with no further changes
- `APP_INITIAL_STATE` now uses `satisfies AppState` instead of an explicit type annotation

## [0.1.2] - 2026-07-16

### Changed
- Root `README.md` rewritten as contributor/repo guide (structure, dev setup, scripts, release process)
- `projects/ngx-mfe-broker/README.md` is now the consumer-facing docs published to npm (replaces Angular CLI scaffold placeholder)
- Corrected "No echo loops" description to reflect value-based inbound guard (no microtask) introduced in 0.1.1
- Added `NGX_MFE_INITIAL_STATE` injection token to the API reference
- Added `npx vitest run` to the building/scripts section

## [0.1.1] - 2026-07-10

### Fixed
- `MfeStateService`: guard `localStorage` with `typeof localStorage !== 'undefined'` to prevent `ReferenceError` in SSR/non-browser environments (BroadcastChannel was already guarded)
- `ConfigRepositoryService`: replaced `queueMicrotask`-based inbound-key guard with a value-based `inboundValues` map — consistent with `MfeStateService` and immune to microtask timing races
- `ConfigRepositoryService`: same SSR guard applied to all `localStorage` accesses
- Removed unused `@angular/common` peer dependency

### Added
- `vitest.config.ts` + `test-setup.ts` enabling `npx vitest run` without Angular CLI

## [0.1.0] - 2025-07-10

### Added
- `MfeStateService` — generic state service backed by Angular Signals, localStorage, and BroadcastChannel cross-tab sync
- `ConfigRepositoryService` — generic string KV store with cross-tab sync and scoped `clear()`
- `provideNgxMfeBroker({ initialState })` — environment provider setup function
- `NGX_MFE_INITIAL_STATE` injection token for state shape definition
- Inbound-key guard on both services to prevent BroadcastChannel echo loops
- Vitest unit test suite (30 tests)
- GitHub Actions CI: build → test on PRs/push, publish to npm on `v*` tags with npm provenance
