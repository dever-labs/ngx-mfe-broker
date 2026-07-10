import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MfeStateService, NGX_MFE_INITIAL_STATE } from './mfe-state.service';

// ── BroadcastChannel mock ─────────────────────────────────────────────────────

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];

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
    MockBroadcastChannel.instances.push(this);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MfeStateService', () => {
  beforeEach(() => {
    localStorage.clear();
    MockBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function setup(initialState: Record<string, unknown> = { theme: 'light' }) {
    TestBed.configureTestingModule({
      providers: [{ provide: NGX_MFE_INITIAL_STATE, useValue: initialState }],
    });
    return {
      svc: TestBed.inject(MfeStateService),
      get channel() { return MockBroadcastChannel.instances[0]; },
    };
  }

  it('returns default value when localStorage is empty', () => {
    const { svc } = setup({ theme: 'light' });
    expect(svc.get<string>('theme')()).toBe('light');
  });

  it('reads persisted value from localStorage on init', () => {
    localStorage.setItem('theme', 'dark');
    const { svc } = setup({ theme: 'light' });
    expect(svc.get<string>('theme')()).toBe('dark');
  });

  it('set() updates the signal', () => {
    const { svc } = setup();
    svc.set('theme', 'dark');
    expect(svc.get<string>('theme')()).toBe('dark');
  });

  it('set() writes to localStorage', () => {
    const { svc } = setup();
    TestBed.flushEffects();
    svc.set('theme', 'dark');
    TestBed.flushEffects();
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('set() broadcasts via BroadcastChannel', () => {
    const { svc, channel } = setup();
    TestBed.flushEffects();
    channel.postMessage.mockClear();

    svc.set('theme', 'dark');
    TestBed.flushEffects();

    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'theme', value: 'dark' }),
    );
  });

  it('receives cross-tab message and updates signal', () => {
    const { svc, channel } = setup();
    channel.receive({ key: 'theme', value: 'dark' });
    expect(svc.get<string>('theme')()).toBe('dark');
  });

  it('does not re-broadcast received cross-tab messages (no echo loop)', () => {
    const { svc, channel } = setup();
    TestBed.flushEffects();
    channel.postMessage.mockClear();

    channel.receive({ key: 'theme', value: 'dark' });
    TestBed.flushEffects();

    expect(channel.postMessage).not.toHaveBeenCalled();
  });

  it('ignores cross-tab message when value is unchanged', () => {
    const { svc, channel } = setup({ theme: 'light' });
    const sig = svc.get<string>('theme');
    channel.receive({ key: 'theme', value: 'light' });
    expect(sig()).toBe('light');
  });

  it('serialises arrays as JSON in localStorage', () => {
    const { svc } = setup({ users: [] as string[] });
    svc.set('users', ['alice', 'bob']);
    TestBed.flushEffects();
    expect(localStorage.getItem('users')).toBe('["alice","bob"]');
  });

  it('deserialises arrays from localStorage on init', () => {
    localStorage.setItem('users', '["alice","bob"]');
    const { svc } = setup({ users: [] as string[] });
    expect(svc.get<string[]>('users')()).toEqual(['alice', 'bob']);
  });

  it('supports numeric state values (e.g. counters)', () => {
    const { svc } = setup({ count: 0 });
    svc.get<number>('count').update(n => n + 1);
    expect(svc.get<number>('count')()).toBe(1);
  });

  it('throws when getting an unregistered key', () => {
    const { svc } = setup({ theme: 'light' });
    expect(() => svc.get('unknown')).toThrow(/Unknown state key "unknown"/);
  });

  it('ngOnDestroy closes the channel', () => {
    const { svc, channel } = setup();
    svc.ngOnDestroy();
    expect(channel.close).toHaveBeenCalled();
  });
});
