// @vitest-environment jsdom
// 6a (Closer-Born v0.6; David 2026-11-03 "go ahead with 6a"): a closing tab
// asks its peer to leave, so the roots and backups it holds are handed off.
// Best effort in a real browser; pinned here: pagehide calls leave() once with
// a non-draining, notifying, zero-wait leave; a back-forward-cache pagehide
// (persisted) does not; after unmount the listener is gone.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';

const { connect, client } = vi.hoisted(() => ({
  connect: vi.fn(),
  client: { setPeer: vi.fn(), whenSeated: vi.fn(async () => {}), replayPendingSends: vi.fn(async () => {}) },
}));
vi.mock('@axona/protocol/connect.js', () => ({ connect: (...a) => connect(...a) }));
vi.mock('../NetworkContext.jsx', () => ({ useNetwork: () => ({ bridgeUrl: 'wss://bridge.test' }) }));
vi.mock('../../services/AxonaChatClient.js', () => ({ default: client }));

import { PeerProvider } from '../PeerContext.jsx';

const session = () => {
  const peer = { peers: () => ['p1'], onLog: () => {}, leave: vi.fn(async () => {}) };
  return { peer, status: { ready: true, peers: 1, ms: 0, reason: 'connected' }, disconnect: vi.fn() };
};
const pagehide = (persisted) => { const e = new Event('pagehide'); Object.defineProperty(e, 'persisted', { value: persisted }); window.dispatchEvent(e); };

beforeEach(() => { connect.mockReset(); localStorage.setItem('axona-onboarded', '1'); });
afterEach(() => { cleanup(); });

describe('6a: pagehide hands off', () => {
  it('a closing tab calls leave() once, non-draining and notifying with the kernel default notify pause', async () => {
    const s = session(); connect.mockResolvedValue(s);
    await act(async () => { render(<PeerProvider><div /></PeerProvider>); });
    await act(async () => { await Promise.resolve(); });
    pagehide(false);
    expect(s.peer.leave).toHaveBeenCalledTimes(1);
    expect(s.peer.leave).toHaveBeenCalledWith({ drain: false, notify: true });
    pagehide(false);
    expect(s.peer.leave).toHaveBeenCalledTimes(1);   // the session is released once; a second pagehide finds none
  });
  it('a back-forward-cache pagehide (persisted) keeps the session', async () => {
    const s = session(); connect.mockResolvedValue(s);
    await act(async () => { render(<PeerProvider><div /></PeerProvider>); });
    await act(async () => { await Promise.resolve(); });
    pagehide(true);
    expect(s.peer.leave).not.toHaveBeenCalled();
  });
  it('after unmount the listener is gone', async () => {
    const s = session(); connect.mockResolvedValue(s);
    let r; await act(async () => { r = render(<PeerProvider><div /></PeerProvider>); });
    await act(async () => { await Promise.resolve(); });
    r.unmount();
    pagehide(false);
    expect(s.peer.leave).not.toHaveBeenCalled();
  });
});
