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

  private readonly storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null;

  private readonly channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

  /**
   * Value-based inbound guard: stores the last value received from another tab.
   * `null` means the last inbound operation was a remove for that key.
   * Checked synchronously in set()/remove() to prevent re-broadcasting received updates.
   */
  private readonly inboundValues = new Map<string, string | null>();

  constructor() {
    this.channel?.addEventListener('message', ({ data }: MessageEvent<ConfigMessage>) => {
      if (data.type === 'clear') {
        // Iterate only the keys the sender owned — not all signals on this tab.
        data.keys.forEach(k => {
          this.inboundValues.set(k, null);
          this.storage?.removeItem(k);
          this.signals.get(k)?.set(null);
        });
      } else if (data.type === 'remove') {
        this.inboundValues.set(data.key, null);
        this.storage?.removeItem(data.key);
        this.signals.get(data.key)?.set(null);
      } else {
        this.inboundValues.set(data.key, data.value);
        this.storage?.setItem(data.key, data.value);
        this.getWritable(data.key).set(data.value);
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
    this.storage?.setItem(key, value);
    this.getWritable(key).set(value);
    if (this.inboundValues.get(key) === value) {
      this.inboundValues.delete(key);
      return;
    }
    this.channel?.postMessage({ type: 'set', key, value } satisfies ConfigMessage);
  }

  remove(key: string): void {
    this.ownedKeys.delete(key);
    this.storage?.removeItem(key);
    this.signals.get(key)?.set(null);
    if (this.inboundValues.get(key) === null && this.inboundValues.has(key)) {
      this.inboundValues.delete(key);
      return;
    }
    this.channel?.postMessage({ type: 'remove', key } satisfies ConfigMessage);
  }

  /** Removes only keys written by this service — does not touch unrelated localStorage entries. */
  clear(): void {
    const keys = [...this.ownedKeys];
    keys.forEach(k => {
      this.storage?.removeItem(k);
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
      this.signals.set(key, signal(this.storage?.getItem(key) ?? null));
    }
    return this.signals.get(key)!;
  }
}
