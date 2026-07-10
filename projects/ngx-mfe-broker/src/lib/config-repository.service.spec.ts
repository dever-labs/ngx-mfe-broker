import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigRepositoryService } from './config-repository.service';

// ── BroadcastChannel mock ─────────────────────────────────────────────────────

class MockBroadcastChannel {
  static instance: MockBroadcastChannel | null = null;

  private listeners: ((e: MessageEvent) => void)[] = [];
  postMessage = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn((_: string, fn: (e: MessageEvent) => void) => {
    this.listeners.push(fn);
  });

  receive(data: unknown): void {
    this.listeners.forEach(fn => fn(new MessageEvent('message', { data })));
  }

  constructor(_name: string) {
    MockBroadcastChannel.instance = this;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConfigRepositoryService', () => {
  beforeEach(() => {
    localStorage.clear();
    MockBroadcastChannel.instance = null;
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function setup() {
    TestBed.configureTestingModule({});
    return {
      svc: TestBed.inject(ConfigRepositoryService),
      get channel() { return MockBroadcastChannel.instance!; },
    };
  }

  it('get() returns null for unknown key', () => {
    expect(setup().svc.get('unknown')).toBeNull();
  });

  it('getSignal() returns null signal for unknown key', () => {
    expect(setup().svc.getSignal('unknown')()).toBeNull();
  });

  it('reads existing localStorage value on first getSignal()', () => {
    localStorage.setItem('apiUrl', 'https://api.example.com');
    expect(setup().svc.get('apiUrl')).toBe('https://api.example.com');
  });

  it('set() updates the signal', () => {
    const { svc } = setup();
    svc.set('key', 'value');
    expect(svc.get('key')).toBe('value');
  });

  it('set() writes to localStorage', () => {
    const { svc } = setup();
    svc.set('key', 'value');
    expect(localStorage.getItem('key')).toBe('value');
  });

  it('set() broadcasts via BroadcastChannel', () => {
    const { svc, channel } = setup();
    svc.set('key', 'value');
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'set', key: 'key', value: 'value' }),
    );
  });

  it('remove() nulls the signal', () => {
    const { svc } = setup();
    svc.set('key', 'value');
    svc.remove('key');
    expect(svc.get('key')).toBeNull();
  });

  it('remove() deletes from localStorage', () => {
    const { svc } = setup();
    svc.set('key', 'value');
    svc.remove('key');
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('remove() broadcasts via BroadcastChannel', () => {
    const { svc, channel } = setup();
    svc.set('key', 'value');
    channel.postMessage.mockClear();
    svc.remove('key');
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'remove', key: 'key' }),
    );
  });

  it('clear() nulls all signals', () => {
    const { svc } = setup();
    svc.set('a', '1');
    svc.set('b', '2');
    svc.clear();
    expect(svc.get('a')).toBeNull();
    expect(svc.get('b')).toBeNull();
  });

  it('clear() broadcasts via BroadcastChannel', () => {
    const { svc, channel } = setup();
    channel.postMessage.mockClear();
    svc.clear();
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'clear' });
  });

  it('receives cross-tab set message and updates signal', () => {
    const { svc, channel } = setup();
    svc.getSignal('key'); // initialise signal
    channel.receive({ type: 'set', key: 'key', value: 'from-other-tab' });
    expect(svc.get('key')).toBe('from-other-tab');
  });

  it('receives cross-tab remove message and nulls signal', () => {
    const { svc, channel } = setup();
    svc.set('key', 'value');
    channel.receive({ type: 'remove', key: 'key' });
    expect(svc.get('key')).toBeNull();
  });

  it('receives cross-tab clear message and nulls all signals', () => {
    const { svc, channel } = setup();
    svc.set('a', '1');
    svc.set('b', '2');
    channel.receive({ type: 'clear' });
    expect(svc.get('a')).toBeNull();
    expect(svc.get('b')).toBeNull();
  });

  it('does not re-broadcast received cross-tab set message', () => {
    const { svc, channel } = setup();
    svc.getSignal('key');
    channel.postMessage.mockClear();
    channel.receive({ type: 'set', key: 'key', value: 'from-other-tab' });
    expect(channel.postMessage).not.toHaveBeenCalled();
  });

  it('ngOnDestroy closes the channel', () => {
    const { svc, channel } = setup();
    svc.ngOnDestroy();
    expect(channel.close).toHaveBeenCalled();
  });
});
