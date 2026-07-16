# ngx-mfe-broker

> Repository for `@dever-labs/ngx-mfe-broker` — an Angular library for sharing state across micro-frontends and browser tabs using Signals, BroadcastChannel, and localStorage.

[![npm](https://img.shields.io/npm/v/@dever-labs/ngx-mfe-broker)](https://www.npmjs.com/package/@dever-labs/ngx-mfe-broker)
[![CI](https://github.com/dever-labs/ngx-mfe-broker/actions/workflows/ci.yml/badge.svg)](https://github.com/dever-labs/ngx-mfe-broker/actions)

For **usage docs, installation, and API reference** see the [package README](projects/ngx-mfe-broker/README.md) (also published to npm).

---

## Repository structure

```
projects/
  ngx-mfe-broker/         ← library source + package README (published to npm)
    src/lib/
      mfe-state.service.ts
      config-repository.service.ts
      provide-ngx-mfe-broker.ts
    README.md             ← consumer-facing docs
dist/                     ← build output (gitignored)
```

## Prerequisites

- Node.js 20+
- npm 9+

## Development setup

```bash
npm ci
```

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Build the library (`dist/ngx-mfe-broker`) |
| `npm test` | Run Vitest tests via Angular CLI |
| `npx vitest run` | Run Vitest directly (no Angular CLI) |
| `npm run lint` | ESLint |

## Release process

Releases are fully automated via GitHub Actions:

1. Update `projects/ngx-mfe-broker/package.json` version
2. Add an entry to `CHANGELOG.md`
3. Push a tag matching `v*` (e.g. `v0.2.0`) — CI builds, tests, lints, and publishes to npm with provenance

## Contributing

1. Fork and create a feature branch
2. Make changes with tests
3. Run lint + build + test before opening a PR
4. All checks must pass on the PR before merge

## License

MIT © [Dever Labs](https://github.com/dever-labs)
