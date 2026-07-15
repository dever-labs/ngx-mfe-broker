# @dever-labs/ngx-mfe-broker

> Angular Signals + BroadcastChannel state broker for micro-frontends

A lightweight library that synchronises state across Angular micro-frontends and browser tabs using **Angular Signals**, **BroadcastChannel**, and **localStorage** — with no external dependencies beyond Angular itself.

## Why?

When using [Native Federation](https://github.com/angular-architects/native-federation) or any Angular micro-frontend architecture, each remote MFE shares the same Angular singleton. State changes in one MFE propagate instantly within the same page — but not across **browser tabs**. This library fills that gap.

| Problem | Solution |
|---|---|
| Theme change in one tab doesn't reflect in others | `MfeStateService` broadcasts via BroadcastChannel |
| Arbitrary config values aren't reactive | `ConfigRepositoryService` — signals backed by localStorage |
| Page refresh loses shared state | Both services persist to localStorage automatically |

## Requirements

- Angular 22+
- Modern browser (BroadcastChannel supported in all current browsers; gracefully skipped in SSR/non-browser environments)
- Node.js 20+

## Installation

```bash
npm install @dever-labs/ngx-mfe-broker
```

## Setup

Call `provideNgxMfeBroker()` **once** — in the shell's `app.config.ts`. The shell always loads first and is the sole owner of initial state values. Remote MFEs reuse the shell's Angular singleton and never call it again.

```typescript
// shell/src/app/app.config.ts
import { provideNgxMfeBroker } from '@dever-labs/ngx-mfe-broker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxMfeBroker({
      initialState: {
        theme: 'light',   // written to localStorage on first boot if not already present
        token: null,
        users: [],        // arrays and objects are serialised as JSON automatically
      }
    }),
  ]
};
```

> **Fail-fast:** if a key is missing from localStorage when the service initialises (in a browser environment), an error is thrown. There are no silent fallbacks — misconfiguration surfaces immediately.

## State Contract Pattern

`@dever-labs/ngx-mfe-broker` is intentionally generic — it knows nothing about your app's domain. To get type safety and avoid magic strings across MFEs, introduce a **state contract**: a shell-owned module that defines the state shape and a typed accessor.

**The shell team owns and maintains the contract.** MFEs that need a new state key raise a PR against the shell repo — the shell team reviews and merges it. This keeps the shared state surface deliberate and auditable.

The contract is the only place key names appear as string literals. Every MFE imports the contract — not the broker directly.

```
                        owned & maintained by shell team
                          ┌─────────────────────────────┐
┌───────────────────────┐ │  state contract              │
│  @dever-labs/         │ │  (AppState,                  │
│  ngx-mfe-broker       │◄┤   APP_STATE_KEYS,            │
│  (generic)            │ │   injectAppState)            │
└───────────────────────┘ └──────────────┬──────────────┘
                                         │ imported by
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
                 shell               MFE A               MFE B
              (owns defaults)
```

The contract lives in a different place depending on whether you have a monorepo or separate repos.

---

### Monorepo

Create a local Angular library (e.g. `@app/mfe-state-model`) inside the same workspace:

```
angular-workspace/
  projects/
    mfe-state-model/          ← state contract library
      src/lib/
        app-state.model.ts
        inject-app-state.ts
    shell/
    mfe-a/
    mfe-b/
```

**`app-state.model.ts`**

```typescript
export interface AppState extends Record<string, unknown> {
  theme: string;
  token: string | null;
  users: string[];
}

// TypeScript interfaces are erased at runtime — this array is the only
// runtime representation of the keys. Add a key here when you add it to AppState.
export const APP_STATE_KEYS = ['theme', 'token', 'users'] as const satisfies (keyof AppState)[];
```

**`inject-app-state.ts`**

```typescript
import { inject, WritableSignal } from '@angular/core';
import { MfeStateService } from '@dever-labs/ngx-mfe-broker';
import { AppState, APP_STATE_KEYS } from './app-state.model';

export function injectAppState() {
  const mfe = inject(MfeStateService);
  return Object.fromEntries(
    APP_STATE_KEYS.map(key => [key, mfe.get(key)])
  ) as { [K in keyof AppState]: WritableSignal<AppState[K]> };
}
```

**Shell `app.config.ts`** — only place that calls `provideNgxMfeBroker` and the only place that owns defaults:

```typescript
import { provideNgxMfeBroker } from '@dever-labs/ngx-mfe-broker';
import { AppState } from '@app/mfe-state-model';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxMfeBroker({
      initialState: {
        theme: 'light-theme',
        token: null,
        users: [],
      } satisfies AppState,   // compile error if a key is missing or wrong type
    }),
  ]
};
```

**Any MFE** — just inject, no provider call:

```typescript
import { injectAppState } from '@app/mfe-state-model';

@Component({ ... })
export class ThemeToggleComponent {
  readonly state = injectAppState();
  // template: {{ state.theme() }}
  // code:     state.theme.set('dark-theme')
}
```

---

### Non-monorepo (separate repos)

The shell team publishes the contract as its own npm package (to npm or a private registry). MFE teams install it as a dependency and raise PRs against the shell repo when they need new keys.

```
@your-org/app-state-model      ← published by shell team
  src/
    app-state.model.ts
    inject-app-state.ts
```

Each MFE repo installs both packages:

```bash
npm install @dever-labs/ngx-mfe-broker @your-org/app-state-model
```

The contract package is tiny — just an interface, a keys array, and the `inject` wrapper. It has no runtime behaviour and a single peer dependency on `@angular/core`.

**`package.json` of the contract package:**

```json
{
  "name": "@your-org/app-state-model",
  "version": "1.0.0",
  "peerDependencies": {
    "@angular/core": ">=22.0.0",
    "@dever-labs/ngx-mfe-broker": ">=0.1.0"
  },
  "sideEffects": false
}
```

> **Versioning tip:** When a key is added or renamed in `AppState`, bump the minor version of the contract package. All MFE repos that install it get compile errors immediately on update — exactly the desired behaviour.

---

## Usage

### `MfeStateService` — typed shared state

```typescript
import { inject } from '@angular/core';
import { MfeStateService } from '@dever-labs/ngx-mfe-broker';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mfe = inject(MfeStateService);

  readonly theme = this.mfe.get<string>('theme'); // WritableSignal<string>

  setTheme(theme: string): void {
    this.mfe.set('theme', theme); // persists + broadcasts cross-tab
  }
}
```

### `ConfigRepositoryService` — generic string KV store

For arbitrary string values that should persist and sync cross-tab independently of the main state:

```typescript
import { inject } from '@angular/core';
import { ConfigRepositoryService } from '@dever-labs/ngx-mfe-broker';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly config = inject(ConfigRepositoryService);

  readonly apiUrl = this.config.getSignal('apiUrl'); // Signal<string | null>

  setApiUrl(url: string): void {
    this.config.set('apiUrl', url);
  }
}
```

## How it works

```
Shell boots → provideNgxMfeBroker({ initialState })
  → each key written to localStorage if not already present
  → signals initialised from localStorage
  → error thrown if any key is missing (no silent fallbacks)

MFE A calls set('theme', 'dark')
  → Signal.set('dark')
  → effect() → localStorage.setItem('theme', 'dark')
  → BroadcastChannel.postMessage({ key: 'theme', value: 'dark' })
      → Tab B receives message
      → Signal.set('dark')
      → effect() skips broadcast (value-based inbound guard)
```

- **Same page**: Signals propagate instantly (shared Angular singleton via Native Federation)
- **Cross-tab**: BroadcastChannel delivers updates to all other tabs on the same origin
- **Persistence**: localStorage survives page refresh; shell writes on first boot only
- **Fail-fast**: missing keys throw on init — no silent fallbacks
- **No echo loops**: Value-based inbound guard prevents re-broadcasting received updates

## API

### `provideNgxMfeBroker(config)`

| Field | Type | Description |
|---|---|---|
| `initialState` | `Record<string, unknown>` | Shell-owned initial values. Each key is written to localStorage on first boot if not already present. Keys not listed here cannot be used at runtime. |

### `NGX_MFE_INITIAL_STATE`

Injection token that holds the initial state shape. Provided automatically by `provideNgxMfeBroker()`. Advanced consumers can provide it directly:

```typescript
import { NGX_MFE_INITIAL_STATE } from '@dever-labs/ngx-mfe-broker';

{ provide: NGX_MFE_INITIAL_STATE, useValue: APP_INITIAL_STATE }
```

### `MfeStateService`

| Method | Signature | Description |
|---|---|---|
| `get<T>(key)` | `(key: string) => WritableSignal<T>` | Returns the signal for a registered key. Throws if the key was not in `initialState`. |
| `set<T>(key, value)` | `(key: string, value: T) => void` | Updates the signal, persists to localStorage, broadcasts cross-tab. |

### `ConfigRepositoryService`

| Method | Signature | Description |
|---|---|---|
| `getSignal(key)` | `(key: string) => Signal<string \| null>` | Readonly signal; initialised from localStorage. |
| `get(key)` | `(key: string) => string \| null` | Current value. |
| `set(key, value)` | `(key: string, value: string) => void` | Persists + broadcasts cross-tab. |
| `remove(key)` | `(key: string) => void` | Removes from localStorage + broadcasts. |
| `clear()` | `() => void` | Removes **only keys written by this service** from localStorage + broadcasts. |

## Building

```bash
npm run build      # ng build ngx-mfe-broker --configuration production
npm test           # Vitest via Angular CLI
npx vitest run     # Vitest directly (no Angular CLI required)
npm run lint       # ESLint
```

## License

MIT © [Dever Labs](https://github.com/dever-labs)
