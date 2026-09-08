// UpdatePrompt applies a waiting service worker BY ITSELF — but never while
// the user is typing.
//
// Why this file exists: until 0.57.0 a new deploy raised a toast with a Reload
// button and a dismiss ✕, so a client that ignored it stayed on the old bundle
// forever. The old bundle carries the old KERNEL PIN, and a client on a
// superseded kernel reaches the bridge and then never meshes — it presents as
// an outage, not as a stale build. That misdiagnosis burned 2026-09-04 (chat
// 366e4b8 chased it through Safari ICE diagnostics) and again 2026-09-08.
//
// The concern that produced the click-gate was real and is preserved: the
// composer holds its draft in a ref, so a reload loses unsent text. Hence two
// behaviours, and both are pinned here, because "applies itself" and "never
// over your typing" are in direct tension and a future edit could satisfy
// either one alone while looking correct.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';

// The virtual module only exists inside a vite build, so it is mocked. The
// component's contract with it is exactly two things: a needRefresh tuple, and
// updateServiceWorker(true) as the "send skipWaiting" call — which is what we
// assert on, since the reload itself is the browser's response to it.
const updateServiceWorker = vi.fn();
let needRefresh = true;
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (opts) => {
    // Registration callback is fired so the polling path is exercised too; a
    // null registration is the documented early-return.
    opts?.onRegisteredSW?.('/sw.js', null);
    return { needRefresh: [needRefresh, vi.fn()], updateServiceWorker };
  },
}));

import UpdatePrompt from '../UpdatePrompt.jsx';

const APPLY_GRACE_MS  = 2500;
const BUSY_RECHECK_MS = 2000;

beforeEach(() => {
  vi.useFakeTimers();
  updateServiceWorker.mockClear();
  needRefresh = true;
  // jsdom has no serviceWorker container; the component guards on 'in navigator',
  // so leaving it absent exercises that guard rather than stubbing past it.
});

afterEach(() => {
  cleanup();
  // testing-library's cleanup unmounts React trees; it does NOT remove nodes
  // appended by hand, and it does not move focus. Without this, a test that
  // focused a field leaves document.activeElement pointing at it and the NEXT
  // test sees "the user is typing" and defers forever. That bit this file on
  // its first run: the auto-apply case failed with 0 calls purely because the
  // contenteditable case above it still held focus.
  document.activeElement?.blur?.();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('UpdatePrompt', () => {
  it('applies a waiting update on its own, with no click', () => {
    render(<UpdatePrompt />);
    expect(updateServiceWorker).not.toHaveBeenCalled();      // not instantly — the notice renders first
    act(() => { vi.advanceTimersByTime(APPLY_GRACE_MS + 50); });
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('does NOT apply while the caret is in a text field', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);              // guard the premise

    render(<UpdatePrompt />);
    act(() => { vi.advanceTimersByTime(APPLY_GRACE_MS + BUSY_RECHECK_MS * 3); });
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('applies once the field loses focus — deferral is not cancellation', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    render(<UpdatePrompt />);
    act(() => { vi.advanceTimersByTime(APPLY_GRACE_MS + 50); });
    expect(updateServiceWorker).not.toHaveBeenCalled();

    act(() => { input.blur(); });
    act(() => { vi.advanceTimersByTime(BUSY_RECHECK_MS + 50); });
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('treats a contenteditable composer as typing, not just <input>', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    // jsdom does not implement isContentEditable from the attribute.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    render(<UpdatePrompt />);
    act(() => { vi.advanceTimersByTime(APPLY_GRACE_MS + BUSY_RECHECK_MS * 2); });
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('does nothing at all when no update is waiting', () => {
    needRefresh = false;
    const { container } = render(<UpdatePrompt />);
    act(() => { vi.advanceTimersByTime(APPLY_GRACE_MS + BUSY_RECHECK_MS * 3); });
    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it('applies exactly once even if the timers keep firing', () => {
    render(<UpdatePrompt />);
    act(() => { vi.advanceTimersByTime(APPLY_GRACE_MS + BUSY_RECHECK_MS * 5); });
    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
  });
});
