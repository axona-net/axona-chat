// The last-arrival stamp is written by the delivery callback, and only by the
// LIVE session's callback.
//
// Why this fence exists (Aster 8aff1137): the store tests proved the labels and
// the action, and nothing proved the one line in subscribeTo that calls it. A
// callback from a replaced session can still fire; if it stamped, a dead
// session would keep the new session's channel reading as fed.
import { describe, it, expect, beforeEach } from 'vitest';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

import AxonaChatClient from '../AxonaChatClient.js';
import { useChatStore } from '../../stores/useChatStore.js';

const LOBBY = { region: 'eagle', name: 'lobby', write: 'open' };
const LOBBY_KEY = `${LOBBY.region}::${LOBBY.name}:${LOBBY.write}`;

// A fake peer that keeps each topic's delivery callback so the test can fire it.
const makeFakePeer = (name) => {
  const p = {
    name, handlers: new Map(),
    sub: async (descriptor, handler) => { p.handlers.set(descriptor.name, handler); return { stop: () => {} }; },
    pub: async () => 'fake-msgid',
    peers: () => [{}],
  };
  return p;
};
const env = (ts, id) => ({ msgId: id, ts, signerPubkey: 'ab'.repeat(32), message: { v: 1, text: 'x' } });
const settle = () => new Promise((r) => setTimeout(r, 50));
const stamp = () => useChatStore.getState().lastArrival[LOBBY_KEY];

describe('the last-arrival stamp', () => {
  beforeEach(() => {
    useChatStore.setState({ subscribedTopics: [LOBBY], currentHandle: null, lastArrival: {} });
    AxonaChatClient.activeSubscriptions.clear();
    AxonaChatClient.stopPresenceHeartbeat?.();
  });

  it('is written when the live session delivers a new message', async () => {
    const A = makeFakePeer('A'); AxonaChatClient.setPeer(A); await settle();
    expect(stamp()).toBeUndefined();
    A.handlers.get('lobby')(env(Date.now(), 'm1'));
    expect(typeof stamp()).toBe('number');
  });

  it('is NOT written by replayed history', async () => {
    const A = makeFakePeer('A'); AxonaChatClient.setPeer(A); await settle();
    A.handlers.get('lobby')(env(Date.now() - 9 * 3600_000, 'old'));
    expect(stamp()).toBeUndefined();
  });

  it('is NOT refreshed by a callback from a replaced session', async () => {
    const A = makeFakePeer('A'); AxonaChatClient.setPeer(A); await settle();
    const stale = A.handlers.get('lobby');
    const B = makeFakePeer('B'); AxonaChatClient.setPeer(B); await settle();
    expect(stamp()).toBeUndefined();
    stale(env(Date.now(), 'from-dead-session'));
    expect(stamp()).toBeUndefined();
    B.handlers.get('lobby')(env(Date.now(), 'from-live-session'));
    expect(typeof stamp()).toBe('number');
  });

  it('is not written by the shared ticker or presence topics', async () => {
    const A = makeFakePeer('A'); AxonaChatClient.setPeer(A); await settle();
    for (const [name, h] of A.handlers) if (name !== 'lobby') h(env(Date.now(), 'x-' + name));
    expect(Object.keys(useChatStore.getState().lastArrival)).toEqual([]);
  });
});
