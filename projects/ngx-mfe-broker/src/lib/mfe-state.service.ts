import { effect, inject, Injectable, InjectionToken, OnDestroy, signal, WritableSignal } from '@angular/core';

const CHANNEL_NAME = '@dever-labs/ngx-mfe-broker:state';

/**
 * Injection token used to supply the initial state keys and their values.
 *
 * Provide this via `provideNgxMfeBroker({ initialState: { ... } })`.
 * The shell is the only place that should call this — it writes each key
 * to localStorage on first boot if it is not already persisted.
 *
 * @example
 * provideNgxMfeBroker({ initialState: { theme: 'light', token: null } })
 */
export const NGX_MFE_INITIAL_STATE = new InjectionToken<Record<string, unknown>>(
  '@dever-labs/ngx-mfe-broker:initial-state',
  { factory: () => ({}) },
);

function serialize(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function deserialize(raw: string, typeHint: unknown): unknown {
  if (typeof typeHint === 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

function stateEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

type StateMessage = { key: string; value: unknown };

/**
 * Generic typed state service for micro-frontends.
 *
 * State is backed by localStorage, reactive via Angular Signals, and
 * synchronised across browser tabs via BroadcastChannel.
 *
 * The shell registers all keys via `provideNgxMfeBroker({ initialState })`,
 * which writes each key to localStorage on first boot. Subsequent reads
 * always come from localStorage — there is no in-memory fallback.
 * If a key is missing from localStorage in a browser environment, an error
 * is thrown so misconfiguration fails loudly rather than silently.
 */
@Injectable({ providedIn: 'root' })
export class MfeStateService implements OnDestroy {
  private readonly signals = new Map<string, WritableSignal<unknown>>();
  /**
   * Value-based guard: stores the last value received from another tab for
   * each key. The effect checks this map instead of a time-sensitive Set so
   * the check happens at effect execution time — guaranteed after the signal
   * update — rather than racing against queueMicrotask cleanup.
   */
  private readonly inboundValues = new Map<string, unknown>();

  private readonly storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null;

  private readonly channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

  constructor() {
    const initialState = inject(NGX_MFE_INITIAL_STATE);

    // Pass 1: shell initialisation write.
    // Write each key to localStorage if it is not already persisted.
    // This is not a fallback — it is the shell's authoritative first write.
    for (const [key, initialValue] of Object.entries(initialState)) {
      if (this.storage !== null && this.storage.getItem(key) === null) {
        this.storage.setItem(key, serialize(initialValue));
      }
    }

    // Pass 2: initialise signals from localStorage.
    // In a browser environment the key must be present after pass 1.
    // Throw loudly if it is not — silent fallbacks hide misconfiguration.
    for (const [key, typeHint] of Object.entries(initialState)) {
      const raw = this.storage?.getItem(key) ?? null;

      if (raw === null && this.storage !== null) {
        throw new Error(
          `[ngx-mfe-broker] Key "${key}" is missing from localStorage. ` +
          `The shell must call provideNgxMfeBroker({ initialState: { ${key}: <value> } }) ` +
          `and finish loading before any MFE reads state.`,
        );
      }

      // SSR / non-browser: no localStorage — use the provided initial value directly.
      const value = raw !== null ? deserialize(raw, typeHint) : typeHint;
      const s = signal(value);
      this.signals.set(key, s);

      effect(() => {
        const current = s();
        this.storage?.setItem(key, serialize(current));
        // Skip broadcast if this value arrived from another tab to prevent echo loops.
        if (stateEqual(current, this.inboundValues.get(key))) {
          this.inboundValues.delete(key);
          return;
        }
        this.channel?.postMessage({ key, value: current } satisfies StateMessage);
      });
    }

    this.channel?.addEventListener('message', ({ data }: MessageEvent<StateMessage>) => {
      const s = this.signals.get(data.key);
      if (!s) return;
      if (stateEqual(s(), data.value)) return;
      // Record the inbound value before updating the signal. The effect will
      // read inboundValues synchronously during its execution and clear the entry.
      this.inboundValues.set(data.key, data.value);
      s.set(data.value);
    });
  }

  /** Get a typed Signal for the given key. Key must be registered in `NGX_MFE_INITIAL_STATE`. */
  get<T>(key: string): WritableSignal<T> {
    if (!this.signals.has(key)) {
      throw new Error(
        `[ngx-mfe-broker] Unknown state key "${key}". ` +
        `Register it in NGX_MFE_INITIAL_STATE via provideNgxMfeBroker({ initialState: { ${key}: <value> } }).`,
      );
    }
    return this.signals.get(key) as WritableSignal<T>;
  }

  /** Set a value — persists to localStorage and broadcasts cross-tab. */
  set<T>(key: string, value: T): void {
    this.get<T>(key).set(value);
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }
}
