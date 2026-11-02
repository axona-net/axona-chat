// @vitest-environment jsdom
// The recovery watchdog must survive a rebuild whose connect() THROWS.
//
// Why this fence exists (2026-11-01 20:26Z, Chrome on the M4, chat 0.101.0):
// the tab showed its last message and never updated again while a Firefox tab
// on the same Mac and the same mesh stayed live. The watchdog had fired once
// (peers dropped to 0 during a mesh churn event), the rebuild's connect()
// rejected with MESH_UNREACHABLE (kernel >= 4.61.2 rejects when no live
// WebRTC bind forms inside ready.timeoutMs), init's catch left currentPeer
// null, and the tick's first line — `if (!currentPeer || recovering) return;`
// — returned on every later tick. One thrown rebuild, then deafness until a
// manual reload. Chrome reaches that state far more readily than Firefox
// because it throttles a tab hidden for 5+ minutes to one timer wakeup a
// minute, which both trips SLEEP_GAP_MS and starves the 8 s connect deadline.
//
// The contract pinned here: a missing session is a watchdog condition, not a
// terminal state. The tick retries on the recover() backoff, and a visibility
// or Page-Lifecycle 'resume' event retries at once.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';

// vi.mock factories are hoisted above every import, so anything they close
// over must be hoisted with them.
const { connect, client } = vi.hoisted(() => ({
  connect: vi.fn(),
  client: { setPeer: vi.fn(), whenSeated: vi.fn(async () => {}), replayPendingSends: vi.fn(async () => {}) },
}));
vi.mock('@axona/protocol/connect.js', () => ({ connect: (...a) => connect(...a) }));
vi.mock('../NetworkContext.jsx', () => ({ useNetwork: () => ({ bridgeUrl: 'wss://bridge.test' }) }));
vi.mock('../../services/AxonaChatClient.js', () => ({ default: client }));

import { PeerProvider } from '../PeerContext.jsx';

// Watchdog constants, restated so a drift in PeerContext fails here by name.
const TICK_MS = 5000;
const RECOVER_AFTER_MS = 25_000;
const RETRY_INITIAL_MS = 10_000;

const meshUnreachable = () => {
  const e = new Error('connect: no live WebRTC peers after 8000ms — reached the bridge but formed no peer mesh');
  e.code = 'MESH_UNREACHABLE';
  return e;
};

// A fake connect() result: `peerList` is mutable so a test can empty the room.
const makeSession = (name, peerList) => {
  const peer = { name, peers: () => peerList, onLog: () => {} };
  return { peer, status: { ready: peerList.length > 0, peers: peerList.length, ms: 0, reason: 'connected' }, disconnect: vi.fn() };
};

const advance = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  connect.mockReset();
  client.setPeer.mockClear();
  localStorage.setItem('axona-onboarded', '1');   // skip the onboarding gate
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe('PeerContext recovery watchdog after a thrown rebuild', () => {
  it('keeps retrying on backoff when the rebuild connect() rejects (the Chrome wedge)', async () => {
    const roomA = [{ id: 'p1' }];
    const sessA = makeSession('A', roomA);
    const sessC = makeSession('C', [{ id: 'p9' }]);
    connect
      .mockResolvedValueOnce(sessA)            // first load: healthy
      .mockRejectedValueOnce(meshUnreachable()) // rebuild #1: thrown (the 0.101.0 killer)
      .mockResolvedValueOnce(sessC);           // rebuild #2: must happen, and must succeed

    render(<PeerProvider><div /></PeerProvider>);
    await advance(0);
    expect(connect).toHaveBeenCalledTimes(1);

    // One tick with a peer marks the session as ever-connected.
    await advance(TICK_MS);

    // The room empties (mesh churn). zeroSince is stamped on the next tick,
    // and the rebuild fires on the first tick MORE than RECOVER_AFTER_MS after
    // that stamp — three ticks of slack covers it. That rebuild throws.
    roomA.length = 0;
    await advance(RECOVER_AFTER_MS + 3 * TICK_MS);
    expect(connect).toHaveBeenCalledTimes(2);

    // 0.101.0 stopped here forever. The fence: within the initial backoff plus
    // one tick, a third connect() is attempted and the new session is seated.
    await advance(RETRY_INITIAL_MS + TICK_MS);
    expect(connect).toHaveBeenCalledTimes(3);
    expect(client.setPeer).toHaveBeenLastCalledWith(sessC.peer);
  });

  it('retries a first-load connect() that rejects, instead of sitting at the error forever', async () => {
    const sessB = makeSession('B', [{ id: 'p2' }]);
    connect
      .mockRejectedValueOnce(meshUnreachable())
      .mockResolvedValueOnce(sessB);

    render(<PeerProvider><div /></PeerProvider>);
    await advance(0);
    expect(connect).toHaveBeenCalledTimes(1);

    await advance(RETRY_INITIAL_MS + TICK_MS);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(client.setPeer).toHaveBeenLastCalledWith(sessB.peer);
  });

  it.each(['visibilitychange', 'resume'])(
    'retries at once on %s when there is no session, without waiting out the backoff',
    async (eventName) => {
      const sessD = makeSession('D', [{ id: 'p3' }]);
      connect
        .mockRejectedValueOnce(meshUnreachable())
        .mockRejectedValueOnce(meshUnreachable())
        .mockResolvedValueOnce(sessD);

      render(<PeerProvider><div /></PeerProvider>);
      await advance(0);
      // With no session the first tick retries at once (the backoff clock
      // starts at zero) and that retry fails; the next is RETRY_INITIAL_MS out.
      await advance(TICK_MS);
      expect(connect).toHaveBeenCalledTimes(2);
      await advance(TICK_MS);
      expect(connect).toHaveBeenCalledTimes(2); // still inside the 10 s backoff

      await act(async () => { document.dispatchEvent(new Event(eventName)); });
      await advance(0);
      expect(connect).toHaveBeenCalledTimes(3);
      expect(client.setPeer).toHaveBeenLastCalledWith(sessD.peer);
    }
  );
});
