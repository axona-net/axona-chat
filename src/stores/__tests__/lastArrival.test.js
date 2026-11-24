// A channel shows when it last HEARD anything, and the app shows which node it
// is. On 2026-11-24 a channel's newest message was stamped 06:21 and nothing
// said the app had heard nothing for nine hours; the node's id was got from the
// developer console.
import { describe, it, expect, beforeEach } from 'vitest';
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
import { useChatStore, arrivalLabel, shortNodeId } from '../useChatStore.js';

describe('noteArrival', () => {
  beforeEach(() => useChatStore.setState({ lastArrival: {} }));

  it('starts with no arrival for any channel', () => {
    expect(useChatStore.getState().lastArrival).toEqual({});
  });
  it('records the time a channel last heard anything, per channel', () => {
    useChatStore.getState().noteArrival('eagle|council', 1000);
    useChatStore.getState().noteArrival('eagle|lobby', 2000);
    useChatStore.getState().noteArrival('eagle|council', 3000);
    expect(useChatStore.getState().lastArrival).toEqual({ 'eagle|council': 3000, 'eagle|lobby': 2000 });
  });
  it('does not touch the newest message or the count', () => {
    const before = useChatStore.getState().topicMetrics;
    useChatStore.getState().noteArrival('eagle|council', 5);
    expect(useChatStore.getState().topicMetrics).toBe(before);
  });
  it('keeps the same state object when nothing changed', () => {
    useChatStore.getState().noteArrival('eagle|council', 7);
    const a = useChatStore.getState().lastArrival;
    useChatStore.getState().noteArrival('eagle|council', 7);
    expect(useChatStore.getState().lastArrival).toBe(a);
  });
});

describe('arrivalLabel', () => {
  const at = new Date(2026, 10, 24, 6, 21, 36).getTime();
  it('says so when nothing has been heard', () => {
    expect(arrivalLabel(undefined)).toBe('nothing heard yet');
    expect(arrivalLabel(0)).toBe('nothing heard yet');
    expect(arrivalLabel(NaN)).toBe('nothing heard yet');
  });
  it('shows a clock time on the same day', () => {
    expect(arrivalLabel(at, new Date(2026, 10, 24, 15, 0, 0).getTime())).toBe('heard 06:21:36');
  });
  it('shows the date once the day has changed, so an old arrival cannot read as today', () => {
    expect(arrivalLabel(at, new Date(2026, 10, 25, 6, 30, 0).getTime())).toBe('heard 2026-11-24 06:21:36');
  });
});

describe('shortNodeId', () => {
  it('is the twelve characters a relay log prints', () => {
    expect(shortNodeId('8925B035D4D1' + 'ab'.repeat(27))).toBe('8925b035d4d1');
  });
  it('shows nothing for a value that is not a node id', () => {
    for (const v of [null, undefined, '', 'node', '8925', 12, {}]) expect(shortNodeId(v)).toBe(null);
  });
});
