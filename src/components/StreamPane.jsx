import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useChatStore, getTopicId } from '../stores/useChatStore.js';
import Message from './Message.jsx';

// THE STREAM: every SUBSCRIBED topic in one list, in the order THIS BROWSER
// received things (David, council seq 433).
//
// WHAT THE ORDERING IS, AND WHAT IT IS NOT. Messages are merged on `_arrivedAt`
// — the moment this client stored them. That is the only ordering a client can
// honestly claim. It is NOT global causality and must never be presented as
// such (Aster, council seq 437): `ts` is the publisher's own clock, replayed
// history lands long after it was written, and two peers can see the same two
// messages in opposite orders without either being wrong. The header says so in
// plain words, because a merged feed implies a timeline whether or not anyone
// meant it to.
//
// IT NEVER AUTO-SUBSCRIBES. It shows the topics you already joined and nothing
// else — no discovery, no silent additions (Aster 437, Vega 434).
//
// PAUSE/FOLLOW, because a feed that reorders itself under a reader is hostile.
// While paused the rendered list is FROZEN and arrivals are counted, not
// inserted. Nothing is dropped: resuming shows everything that landed. This is
// the user-controlled half of "engaging" — it is their attention and the
// control over it stays with them (Aster 437, seconded seq 440).

const StreamPane = ({ setReplyTarget, setPrivateReplyTarget }) => {
  const subscribedTopics = useChatStore(s => s.subscribedTopics);
  const messages = useChatStore(s => s.messages);
  const lastRead = useChatStore(s => s.lastRead);

  const listRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const frozenRef = useRef(null);

  // Merge → dedup → order. Dedup is on the FULL msgId, never a prefix: a
  // truncated id can collide, and the same message legitimately appears under
  // two topics when someone is subscribed to both spellings of a descriptor.
  const merged = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const topic of subscribedTopics) {
      const tid = getTopicId(topic);
      for (const env of (messages[tid] || [])) {
        if (!env?.msgId || seen.has(env.msgId)) continue;
        seen.add(env.msgId);
        out.push({ env, topic, tid, at: env._arrivedAt ?? env.ts ?? 0 });
      }
    }
    out.sort((a, b) => a.at - b.at);
    return out;
  }, [subscribedTopics, messages]);

  // While paused, render the frozen snapshot; count what has arrived since.
  const shown = paused && frozenRef.current ? frozenRef.current : merged;
  const pendingCount = paused && frozenRef.current
    ? Math.max(0, merged.length - frozenRef.current.length)
    : 0;

  const togglePause = () => {
    if (paused) { frozenRef.current = null; setPaused(false); }
    else { frozenRef.current = merged; setPaused(true); }
  };

  // Follow the tail only while not paused, and only if the reader is already
  // near the bottom — nobody scrolled up should be yanked back down.
  useEffect(() => {
    if (paused) return;
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [shown.length, paused]);

  const labelFor = (topic) => topic.description?.startsWith('Private chat with ')
    ? topic.description.replace('Private chat with ', '')
    : `#${topic.name}`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>≋ Stream</span>
          {/* COUNT WHAT IS ON SCREEN, not what is known. While paused these two
              differ, and a header reading "8 messages" above a list of 6 is two
              numbers disagreeing in the same view — the failure I spent today
              making elsewhere. The held count lives on the Resume button, where
              it is an offer rather than a contradiction. */}
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            {subscribedTopics.length} topic{subscribedTopics.length === 1 ? '' : 's'} · {shown.length} message{shown.length === 1 ? '' : 's'}
            {paused && pendingCount > 0 && ' shown'}
          </span>
          <button
            type="button"
            onClick={togglePause}
            aria-pressed={paused}
            title={paused
              ? 'Resume following — nothing was lost while paused'
              : 'Pause the stream so it stops moving while you read'}
            style={{
              marginLeft: 'auto',
              padding: '0.25rem 0.7rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              borderRadius: 'var(--radius)',
              border: '1px solid ' + (paused ? 'var(--color-primary)' : 'var(--border-color)'),
              background: paused ? 'var(--color-primary)' : 'transparent',
              color: paused ? '#fff' : 'var(--color-text)',
              cursor: 'pointer'
            }}
          >
            {paused ? (pendingCount > 0 ? `Resume · ${pendingCount} new` : 'Resume') : 'Pause'}
          </button>
        </div>
        {/* Said in the interface, not just in a comment. A merged feed reads as
            a timeline, and this one is not one. */}
        <div style={{ fontSize: '0.68rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>
          In the order <b>this browser</b> received them — not a network-wide
          timeline. Another peer may have seen the same messages in a different
          order.
        </div>
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        {shown.length === 0 ? (
          <div style={{ margin: 'auto', color: 'var(--color-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
            Nothing has arrived yet in the topics you have joined.
          </div>
        ) : shown.map(({ env, topic, tid }) => {
          const unread = env.ts > (lastRead[tid] || 0);
          return (
            <div key={env.msgId} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* SOURCE BADGE: in a merged list the topic is not implied by
                  where you are, so every message has to carry its own. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.35rem 0 0.1rem' }}>
                <span style={{
                  fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.3px',
                  padding: '1px 6px', borderRadius: '10px',
                  background: 'var(--color-bg)', border: '1px solid var(--border-color)',
                  color: 'var(--color-muted)', whiteSpace: 'nowrap'
                }}>
                  {labelFor(topic)}
                </span>
                {unread && (
                  <span title="You have not read this one yet"
                        style={{ fontSize: '0.55rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                    ● NEW
                  </span>
                )}
              </div>
              <Message
                envelope={env}
                activeTopic={topic}
                onReply={(e) => setReplyTarget?.(e)}
                onPrivateReply={(e) => setPrivateReplyTarget?.(e)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StreamPane;
