import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from '../stores/useChatStore.js';
import Message from './Message.jsx';
import AxonaChatClient from '../services/AxonaChatClient.js';

const MessagePane = ({ onOpenModal, setReplyTarget, setPrivateReplyTarget }) => {
  const { activeTopic, activeTopicId, messages, currentHandle, moderationQueue, topicMetrics } = useChatStore();
  const advertisedTopics = useChatStore(s => s.advertisedTopics);
  const messagesEndRef = useRef(null);

  // ONE advertisement per topic. Ads carry the kernel-derived hex topic id,
  // so compare against the active topic's hex id (same derivation the network
  // uses — immune to region-name spelling like useast vs its canonical name).
  // Retracting/expiring the ad removes it from the store → button re-enables.
  // Mobile: the floating "☰ Topics" pill sits over the header's top-left, so
  // indent the header content past it (same 800px threshold as ChatShell).
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 800);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 800);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [activeHexId, setActiveHexId] = useState(null);
  useEffect(() => {
    let stale = false;
    setActiveHexId(null);
    AxonaChatClient.getTopicHexId(activeTopic)
      .then((id) => { if (!stale) setActiveHexId(id); })
      .catch(() => { if (!stale) setActiveHexId(null); });
    return () => { stale = true; };
  }, [activeTopicId]);
  const alreadyAdvertised = !!activeHexId && advertisedTopics.some(ad => ad.topicId === activeHexId);

  // Get envelopes for active topic
  const activeEnvelopes = messages[activeTopicId] || [];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeEnvelopes.length]);

  // Unread bookkeeping. Arrivals while the tab is VISIBLE are marked read by
  // the store as they land; this covers the remaining case — messages that
  // arrived on the active topic while the tab was hidden become read when the
  // user returns to it.
  useEffect(() => {
    const markIfVisible = () => {
      if (document.visibilityState === 'visible') {
        useChatStore.getState().markTopicRead(activeTopicId);
      }
    };
    document.addEventListener('visibilitychange', markIfVisible);
    return () => document.removeEventListener('visibilitychange', markIfVisible);
  }, [activeTopicId]);

  // Nests replies under their parent
  const buildThreadTree = (envelopes) => {
    const map = new Map();
    const roots = [];

    // Initialize map
    envelopes.forEach(env => {
      map.set(env.msgId, { ...env, children: [] });
    });

    // Populate children or roots
    envelopes.forEach(env => {
      const item = map.get(env.msgId);
      const parentId = env.message?.replyTo;
      if (parentId && map.has(parentId)) {
        map.get(parentId).children.push(item);
      } else {
        roots.push(item);
      }
    });

    // Bubble active threads
    // Sort root threads by the timestamp of their latest message (parent or child)
    const getLatestTimestamp = (node) => {
      let latest = node.ts;
      node.children.forEach(child => {
        const childLatest = getLatestTimestamp(child);
        if (childLatest > latest) latest = childLatest;
      });
      return latest;
    };

    roots.sort((a, b) => getLatestTimestamp(a) - getLatestTimestamp(b));

    return roots;
  };

  const threadTree = buildThreadTree(activeEnvelopes);

  // Render tree recursively
  const renderThreadNodes = (nodes, level = 0) => {
    return nodes.map(node => (
      <div key={node.msgId} style={{ display: 'flex', flexDirection: 'column' }}>
        <Message
          envelope={node}
          activeTopic={activeTopic}
          onReply={(env) => setReplyTarget(env)}
          onPrivateReply={(env) => setPrivateReplyTarget(env)}
          level={level}
        />
        {node.children.length > 0 && renderThreadNodes(node.children, level + 1)}
      </div>
    ));
  };

  const isOwner = activeTopic.owner && currentHandle && activeTopic.owner === currentHandle.authorId;
  const queueCount = (moderationQueue[activeTopicId] || []).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden'
    }}>
      {/* Header Info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1rem',
        paddingLeft: isMobile ? '7rem' : '1rem',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--border-color)',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>
              #{activeTopic.name}
            </h3>
            <span style={{
              fontSize: '0.6rem',
              padding: '1px 5px',
              borderRadius: '3px',
              background: activeTopic.mode === 'moderated' ? '#e67e22' : activeTopic.mode === 'controlled' ? '#9b59b6' : 'var(--color-bg)',
              color: (activeTopic.mode === 'open' || !activeTopic.mode) ? 'var(--color-muted)' : '#fff',
              border: (activeTopic.mode === 'open' || !activeTopic.mode) ? '1px solid var(--border-color)' : 'none',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {activeTopic.mode || 'open'}
            </span>
            <span
              title="How many messages this topic currently holds on the network ('…' means the count hasn't arrived yet)"
              style={{
              fontSize: '0.65rem',
              padding: '1px 5px',
              borderRadius: '3px',
              background: 'var(--color-bg)',
              color: 'var(--color-muted)',
              border: '1px solid var(--border-color)',
              fontWeight: '500'
            }}>
              📊 {topicMetrics[activeTopicId] && topicMetrics[activeTopicId].current_count !== undefined && topicMetrics[activeTopicId].current_count !== null
                ? `${topicMetrics[activeTopicId].current_count} messages`
                : '… messages'
              }
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            Region: {activeTopic.region || 'global'} · Owner: {activeTopic.owner ? `${activeTopic.owner.slice(0, 16)}...` : 'None'}
          </span>
        </div>

        {/* Header Controls */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* Advertise Button (not on the ticker itself) */}
          {activeTopic.name !== 'advertised-topics' && (
            <button
              onClick={() => { if (!alreadyAdvertised) onOpenModal('advertise'); }}
              disabled={alreadyAdvertised}
              title={alreadyAdvertised
                ? 'This topic is already on the DISCOVER ticker — one advertisement per topic. If the ad is yours, retract it there first to re-advertise'
                : 'Invite others in: this shares the topic on the DISCOVER ticker so anyone on the network can find it and join the conversation'}
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
                background: 'var(--color-bg)',
                border: '1px solid var(--border-color)',
                color: alreadyAdvertised ? 'var(--color-muted)' : 'var(--color-text)',
                opacity: alreadyAdvertised ? 0.55 : 1,
                cursor: alreadyAdvertised ? 'default' : 'pointer',
                borderRadius: '4px'
              }}
            >
              📢 {alreadyAdvertised ? 'Advertised' : 'Advertise'}
            </button>
          )}

          {/* ACL editor (controlled & owner) */}
          {activeTopic.mode === 'controlled' && isOwner && (
            <button
              onClick={() => onOpenModal('acl')}
              title="Manage who is allowed to post in this topic"
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
                background: 'var(--color-primary-dark)',
                color: '#fff',
                borderRadius: '4px'
              }}
            >
              ⚙️ Manage ACL
            </button>
          )}

          {/* Moderation queue (moderated & owner) */}
          {activeTopic.mode === 'moderated' && isOwner && (
            <button
              onClick={() => onOpenModal('moderation')}
              title="Review messages people have submitted to this moderated topic — approve the ones to publish"
              style={{
                fontSize: '0.75rem',
                padding: '0.3rem 0.6rem',
                background: '#e67e22',
                color: '#fff',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>Queue</span>
              {queueCount > 0 && (
                <span style={{
                  background: '#c0392b',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  padding: '1px 5px',
                  borderRadius: '10px'
                }}>
                  {queueCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Message List area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {activeEnvelopes.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: 'var(--color-muted)',
            fontSize: '0.9rem',
            gap: '0.5rem'
          }}>
            <span>No messages in this channel yet.</span>
            <span style={{ fontSize: '0.8rem' }}>Be the first to speak!</span>
          </div>
        ) : (
          renderThreadNodes(threadTree)
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessagePane;
