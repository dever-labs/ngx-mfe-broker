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

Call `provideNgxMfeBroker()` **once** — in the shell's `app.config.ts`. Remote MFEs reuse the shell's Angular singleton and do not call it again.

```typescript
// shell/src/app/app.config.ts
import { provideNgxMfeBroker } from '@dever-labs/ngx-mfe-broker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxMfeBroker({
      initialState: {
        theme: 'light',   // string
        token: null,      // string | null
        users: [],        // array — serialised as JSON automatically
      }
    }),
  ]
};
```

> **Important:** `get(key)` throws if the key was not registered in `initialState`. All state keys must be declared upfront.

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

For arbitrary string values that should persist and sync cross-tab independently of `MfeStateService`:

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
MFE A calls set('theme', 'dark')
  → Signal.set('dark')
  → effect() → localStorage.setItem('theme', 'dark')
  → BroadcastChannel.postMessage({ key: 'theme', value: 'dark' })
      → Tab B receives message
      → Signal.set('dark')  (inbound-key guard prevents echo loop)
      → effect() skips broadcast (key in guard)
```

- **Same page**: Signals propagate instantly (shared Angular singleton via Native Federation)
- **Cross-tab**: BroadcastChannel delivers updates to all other tabs on the same origin
- **Persistence**: localStorage survives page refresh; values are restored on init
- **No echo loops**: Inbound-key guard + microtask clear prevents re-broadcasting received updates

## API

### `provideNgxMfeBroker(config)`

| Field | Type | Description |
|---|---|---|
| `initialState` | `Record<string, unknown>` | All state keys with their default values. Keys not listed here cannot be used at runtime. |

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
npm run build   # ng build ngx-mfe-broker --configuration production
npm test        # Vitest unit tests
npm run lint    # ESLint
```

## License

MIT © [Dever Labs](https://github.com/dever-labs)
