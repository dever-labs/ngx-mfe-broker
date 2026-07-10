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

  it('clear() nulls only owned signals, not read-only observed keys', () => {
    const { svc } = setup();
    localStorage.setItem('external', 'keep-me');
    svc.getSignal('external'); // observe but never write
    svc.set('owned', '1');
    svc.clear();
    expect(svc.get('owned')).toBeNull();
    // signal for 'external' must NOT be nulled — it was never owned
    expect(svc.get('external')).toBe('keep-me');
  });

  it('clear() only removes its own localStorage keys, not unrelated entries', () => {
    localStorage.setItem('unrelated', 'should-survive');
    const { svc } = setup();
    svc.set('a', '1');
    svc.clear();
    expect(localStorage.getItem('unrelated')).toBe('should-survive');
    expect(localStorage.getItem('a')).toBeNull();
  });

  it('clear() broadcasts with the list of keys being cleared', () => {
    const { svc, channel } = setup();
    svc.set('a', '1');
    svc.set('b', '2');
    channel.postMessage.mockClear();
    svc.clear();
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'clear', keys: expect.arrayContaining(['a', 'b']) }),
    );
  });

  it('receives cross-tab set message, updates signal and localStorage', () => {
    const { svc, channel } = setup();
    svc.getSignal('key');
    channel.receive({ type: 'set', key: 'key', value: 'from-other-tab' });
    expect(svc.get('key')).toBe('from-other-tab');
    expect(localStorage.getItem('key')).toBe('from-other-tab');
  });

  it('receives cross-tab remove message, nulls signal and localStorage', () => {
    const { svc, channel } = setup();
    svc.set('key', 'value');
    channel.receive({ type: 'remove', key: 'key' });
    expect(svc.get('key')).toBeNull();
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('receives cross-tab clear message, only removes sender-owned keys', () => {
    const { svc, channel } = setup();
    svc.set('a', '1');
    localStorage.setItem('external', 'keep-me');
    svc.getSignal('external'); // observed but not owned by sender
    channel.receive({ type: 'clear', keys: ['a'] }); // sender only owned 'a'
    expect(svc.get('a')).toBeNull();
    expect(localStorage.getItem('a')).toBeNull();
    // 'external' not in sender's keys list — must survive
    expect(localStorage.getItem('external')).toBe('keep-me');
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
