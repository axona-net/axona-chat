// THE STREAM MERGES WHAT YOU ALREADY JOINED, IN THE ORDER YOU SAW IT.
//
// Conditions carried from council: merge the user's SUBSCRIBED topics by LOCAL
// ARRIVAL order with source-topic badges, full-message-ID dedup, unread markers
// and a pause/follow control; do NOT present arrival order as global causality;
// do NOT auto-subscribe to new topics (Aster seq 437, Vega seq 434, David 433).
//
// Each of those is a property someone could quietly drop while "improving" the
// view, and none of them fail loudly at runtime — a stream that silently
// auto-subscribes or that sorts by publisher `ts` looks perfectly fine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const pane  = readFileSync('src/components/StreamPane.jsx', 'utf8');
const shell = readFileSync('src/components/ChatShell.jsx', 'utf8');
const store = readFileSync('src/stores/useChatStore.js', 'utf8');

describe('StreamPane', () => {
  it('merges only SUBSCRIBED topics — it never discovers or auto-subscribes', () => {
    expect(/for \(const topic of subscribedTopics\)/.test(pane)).toBe(true);
    // No call that would add a subscription from this view.
    expect(/addTopic|subscribe\(/.test(pane)).toBe(false);
  });

  it('orders by LOCAL ARRIVAL, not by the publisher clock', () => {
    expect(/env\._arrivedAt \?\? env\.ts/.test(pane)).toBe(true);
    expect(/out\.sort\(\(a, b\) => a\.at - b\.at\)/.test(pane)).toBe(true);
  });

  it('the store stamps local arrival, because nothing on the wire carries it', () => {
    expect(/_arrivedAt: Date\.now\(\)/.test(store)).toBe(true);
  });

  it('dedups on the FULL msgId, never a prefix', () => {
    expect(/seen\.has\(env\.msgId\)/.test(pane)).toBe(true);
    expect(/seen\.add\(env\.msgId\)/.test(pane)).toBe(true);
    expect(/msgId\.slice/.test(pane)).toBe(false);
  });

  it('SAYS IN THE INTERFACE that this is not a network-wide timeline', () => {
    expect(/not a network-wide/.test(pane)).toBe(true);
    expect(/different\s*\n?\s*order/.test(pane)).toBe(true);
  });

  it('every message carries its source topic, since position no longer implies it', () => {
    expect(/labelFor\(topic\)/.test(pane)).toBe(true);
  });

  it('marks unread against the per-topic watermark', () => {
    expect(/env\.ts > \(lastRead\[tid\] \|\| 0\)/.test(pane)).toBe(true);
  });
});

describe('pause/follow holds the list still without losing anything', () => {
  it('pausing freezes the RENDERED list rather than stopping intake', () => {
    expect(/frozenRef\.current = merged/.test(pane)).toBe(true);
    expect(/paused && frozenRef\.current \? frozenRef\.current : merged/.test(pane)).toBe(true);
  });

  it('held arrivals are COUNTED and surfaced as an offer', () => {
    expect(/pendingCount/.test(pane)).toBe(true);
    expect(/Resume · \$\{pendingCount\} new/.test(pane)).toBe(true);
  });

  it('resuming clears the freeze so nothing stays hidden', () => {
    expect(/frozenRef\.current = null; setPaused\(false\)/.test(pane)).toBe(true);
  });

  it('the control announces its state', () => {
    expect(/aria-pressed=\{paused\}/.test(pane)).toBe(true);
  });

  it('the header counts WHAT IS SHOWN, so it cannot contradict the list', () => {
    // A header reading "8 messages" above a list of 6 is two numbers
    // disagreeing in one view. The held count belongs on the Resume button.
    expect(/\{shown\.length\} message/.test(pane)).toBe(true);
    expect(/\{merged\.length\} message/.test(pane)).toBe(false);
  });

  it('auto-follow is suppressed while paused and never yanks a reader up-scroll', () => {
    expect(/if \(paused\) return;/.test(pane)).toBe(true);
    expect(/nearBottom/.test(pane)).toBe(true);
  });
});

describe('shell wiring', () => {
  it('Stream replaces the message pane rather than stacking with it', () => {
    expect(/streamMode \? \(\s*<StreamPane/.test(shell)).toBe(true);
  });

  it('the composer is HIDDEN in stream mode — there is no one topic to post to', () => {
    expect(/\{!streamMode && \(\s*<Composer/.test(shell)).toBe(true);
  });

  it('choosing a topic leaves the stream', () => {
    expect(/activeTopicId: id, streamMode: false/.test(store)).toBe(true);
  });
});
