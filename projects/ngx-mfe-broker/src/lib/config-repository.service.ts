import { Injectable, signal, Signal, WritableSignal, OnDestroy } from '@angular/core';

const CHANNEL_NAME = '@dever-labs/ngx-mfe-broker:config';

type ConfigMessage =
  | { type: 'set'; key: string; value: string }
  | { type: 'remove'; key: string }
  | { type: 'clear'; keys: string[] };

/**
 * Generic cross-tab string key-value store backed by localStorage.
 * Changes are broadcast to all other tabs/windows via BroadcastChannel.
 */
@Injectable({ providedIn: 'root' })
export class ConfigRepositoryService implements OnDestroy {
  private readonly signals = new Map<string, WritableSignal<string | null>>();
  /** Tracks every key ever written so clear() only removes its own keys. */
  private readonly ownedKeys = new Set<string>();

  private readonly channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

  private readonly inboundKeys = new Set<string>();

  constructor() {
    this.channel?.addEventListener('message', ({ data }: MessageEvent<ConfigMessage>) => {
      if (data.type === 'clear') {
        // Iterate only the keys the sender owned — not all signals on this tab.
        data.keys.forEach(k => {
          this.inboundKeys.add(k);
          localStorage.removeItem(k);
          this.signals.get(k)?.set(null);
        });
        queueMicrotask(() => data.keys.forEach(k => this.inboundKeys.delete(k)));
      } else if (data.type === 'remove') {
        this.inboundKeys.add(data.key);
        localStorage.removeItem(data.key);
        this.signals.get(data.key)?.set(null);
        queueMicrotask(() => this.inboundKeys.delete(data.key));
      } else {
        this.inboundKeys.add(data.key);
        localStorage.setItem(data.key, data.value);
        this.getWritable(data.key).set(data.value);
        queueMicrotask(() => this.inboundKeys.delete(data.key));
      }
    });
  }

  getSignal(key: string): Signal<string | null> {
    return this.getWritable(key).asReadonly();
  }

  get(key: string): string | null {
    return this.getSignal(key)();
  }

  set(key: string, value: string): void {
    this.ownedKeys.add(key);
    localStorage.setItem(key, value);
    this.getWritable(key).set(value);
    if (!this.inboundKeys.has(key)) {
      this.channel?.postMessage({ type: 'set', key, value } satisfies ConfigMessage);
    }
  }

  remove(key: string): void {
    this.ownedKeys.delete(key);
    localStorage.removeItem(key);
    this.signals.get(key)?.set(null);
    if (!this.inboundKeys.has(key)) {
      this.channel?.postMessage({ type: 'remove', key } satisfies ConfigMessage);
    }
  }

  /** Removes only keys written by this service — does not touch unrelated localStorage entries. */
  clear(): void {
    const keys = [...this.ownedKeys];
    keys.forEach(k => {
      localStorage.removeItem(k);
      this.signals.get(k)?.set(null);
    });
    this.ownedKeys.clear();
    this.channel?.postMessage({ type: 'clear', keys } satisfies ConfigMessage);
  }

  ngOnDestroy(): void {
    this.channel?.close();
  }

  private getWritable(key: string): WritableSignal<string | null> {
    if (!this.signals.has(key)) {
      this.signals.set(key, signal(localStorage.getItem(key)));
    }
    return this.signals.get(key)!;
  }
}
