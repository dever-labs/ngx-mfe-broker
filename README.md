# @dever-labs/ngx-mfe-broker

> Angular Signals + BroadcastChannel state broker for micro-frontends

A lightweight library that synchronises state across Angular micro-frontends and browser tabs using **Angular Signals**, **BroadcastChannel**, and **localStorage** — with no external dependencies beyond Angular itself.

## Why?

When using [Native Federation](https://github.com/angular-architects/native-federation) or any Angular micro-frontend architecture, each remote MFE shares the same Angular singleton (if configured correctly), but state changes in one MFE still don't propagate across **browser tabs**. This library fills that gap.

| Problem | Solution |
|---|---|
| Theme change in one tab doesn't reflect in others | `MfeStateService` broadcasts via BroadcastChannel |
| Arbitrary config values aren't reactive | `ConfigRepositoryService` — signals backed by localStorage |
| Menu items lost on reload | `MenuRegistryService` — load from API once, share via Signal |
| Cross-MFE search/command palette trigger | `MfeStateService.openSearch()` |

## Installation

```bash
npm install @dever-labs/ngx-mfe-broker
```

## Setup

In each micro-frontend's `app.config.ts`, define your state shape and defaults:

```typescript
import { provideNgxMfeBroker } from '@dever-labs/ngx-mfe-broker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNgxMfeBroker({
      initialState: {
        theme: 'light',   // string
        token: null,      // string | null
        users: [],        // array — serialised as JSON
      }
    }),
  ]
};
```

> All MFEs should provide the same `initialState` shape so their signals stay in sync.

## Usage

### Typed state with `MfeStateService`

```typescript
import { inject } from '@angular/core';
import { MfeStateService } from '@dever-labs/ngx-mfe-broker';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mfe = inject(MfeStateService);

  readonly theme = this.mfe.get<string>('theme');

  setTheme(theme: string): void {
    this.mfe.set('theme', theme);
  }
}
```

### Generic key-value config with `ConfigRepositoryService`

For arbitrary string values that should persist and sync cross-tab:

```typescript
import { inject } from '@angular/core';
import { ConfigRepositoryService } from '@dever-labs/ngx-mfe-broker';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly config = inject(ConfigRepositoryService);

  readonly apiUrl = this.config.getSignal('apiUrl');

  setApiUrl(url: string): void {
    this.config.set('apiUrl', url);
  }
}
```

### Menu registry with `MenuRegistryService`

```typescript
import { inject } from '@angular/core';
import { MenuRegistryService } from '@dever-labs/ngx-mfe-broker';

// Shell: load menu from API
const menu = inject(MenuRegistryService);
menu.load(await fetch('/api/menu').then(r => r.json()));

// MFE: register a dynamic item
menu.register({ label: 'Reports', path: '/reports', icon: 'pi pi-chart-bar' });

// Template:
@Component({
  template: `@for (item of menu.items(); track item.path) { ... }`
})
```

### Cross-MFE search / command palette

```typescript
// Trigger from any MFE or tab:
inject(MfeStateService).openSearch();

// Listen in the shell:
effect(() => {
  if (mfeState.searchOpen() > 0) showCommandPalette();
});
```

## API

### `provideNgxMfeBroker(config)`

| Field | Type | Description |
|---|---|---|
| `initialState` | `Record<string, unknown>` | State keys with their default values |

### `MfeStateService`

| Method/Property | Description |
|---|---|
| `get<T>(key)` | Returns a `WritableSignal<T>` backed by localStorage |
| `set<T>(key, value)` | Sets value — persists + broadcasts cross-tab |
| `searchOpen` | `Signal<number>` — increments each time search should open |
| `openSearch()` | Increments `searchOpen` and broadcasts to all tabs |

### `ConfigRepositoryService`

| Method | Description |
|---|---|
| `getSignal(key)` | Returns a readonly `Signal<string \| null>` |
| `get(key)` | Returns current `string \| null` value |
| `set(key, value)` | Persists + broadcasts cross-tab |
| `remove(key)` | Removes from localStorage + broadcasts |
| `clear()` | Clears all localStorage + broadcasts |

### `MenuRegistryService`

| Method/Property | Description |
|---|---|
| `items` | Readonly `Signal<MenuItem[]>` |
| `load(items)` | Replace full menu list |
| `register(item)` | Add or update an item (matched by `path`) |
| `unregister(path)` | Remove an item by path |

### `MenuItem`

```typescript
interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  remoteEntry?: string;
  remoteName?: string;
  exposedModule?: string;
  children?: MenuItem[];
}
```

## How it works

```
MFE A sets value
  → Signal.set()
  → effect() writes to localStorage
  → BroadcastChannel.postMessage()
      → MFE B tab receives message
      → Signal.set() (inbound guard prevents echo loop)
```

- **Same page**: Signals propagate instantly (shared singleton via Native Federation)
- **Cross-tab**: BroadcastChannel delivers updates to all other tabs on the same origin
- **Persistence**: localStorage survives page refresh
- **No echo loops**: Inbound-key guard + microtask clear prevents re-broadcasting received updates

## Requirements

- Angular 22+
- Modern browser (BroadcastChannel supported in all current browsers; gracefully skipped in SSR/non-browser environments)

## Building

```bash
ng build ngx-mfe-broker
```

## License

MIT © [Dever Labs](https://github.com/dever-labs)
