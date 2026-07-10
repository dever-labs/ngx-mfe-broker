# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-07-10

### Added
- `MfeStateService` — generic state service backed by Angular Signals, localStorage, and BroadcastChannel cross-tab sync
- `ConfigRepositoryService` — generic string KV store with cross-tab sync and scoped `clear()`
- `provideNgxMfeBroker({ initialState })` — environment provider setup function
- `NGX_MFE_INITIAL_STATE` injection token for state shape definition
- Inbound-key guard on both services to prevent BroadcastChannel echo loops
- Vitest unit test suite (30 tests)
- GitHub Actions CI: build → test on PRs/push, publish to npm on `v*` tags with npm provenance
