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

  /** Simulate receiving a message from another tab. */
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
      get stateChannel() { return MockBroadcastChannel.instances[0]; },
      get searchChannel() { return MockBroadcastChannel.instances[1]; },
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
    const { svc, stateChannel } = setup();
    TestBed.flushEffects();
    stateChannel.postMessage.mockClear();

    svc.set('theme', 'dark');
    TestBed.flushEffects();

    expect(stateChannel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'theme', value: 'dark' }),
    );
  });

  it('receives cross-tab message and updates signal', () => {
    const { svc, stateChannel } = setup();
    stateChannel.receive({ key: 'theme', value: 'dark' });
    expect(svc.get<string>('theme')()).toBe('dark');
  });

  it('does not re-broadcast received cross-tab messages (no echo loop)', () => {
    const { svc, stateChannel } = setup();
    TestBed.flushEffects();
    stateChannel.postMessage.mockClear();

    stateChannel.receive({ key: 'theme', value: 'dark' });
    TestBed.flushEffects();

    expect(stateChannel.postMessage).not.toHaveBeenCalled();
  });

  it('ignores cross-tab message when value is unchanged', () => {
    const { svc, stateChannel } = setup({ theme: 'light' });
    const signal = svc.get<string>('theme');
    stateChannel.receive({ key: 'theme', value: 'light' });
    expect(signal()).toBe('light');
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

  it('openSearch() increments searchOpen signal', () => {
    const { svc } = setup();
    expect(svc.searchOpen()).toBe(0);
    svc.openSearch();
    expect(svc.searchOpen()).toBe(1);
  });

  it('openSearch() posts to search channel', () => {
    const { svc, searchChannel } = setup();
    svc.openSearch();
    expect(searchChannel.postMessage).toHaveBeenCalledWith('open');
  });

  it('search channel message increments searchOpen', () => {
    const { svc, searchChannel } = setup();
    searchChannel.receive('open');
    expect(svc.searchOpen()).toBe(1);
  });

  it('ngOnDestroy closes both channels', () => {
    const { svc, stateChannel, searchChannel } = setup();
    svc.ngOnDestroy();
    expect(stateChannel.close).toHaveBeenCalled();
    expect(searchChannel.close).toHaveBeenCalled();
  });
});
