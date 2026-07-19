import React, { useState, useEffect } from 'react';
import { KERNEL_VERSION } from '@axona/protocol';
import { useChatStore } from '../stores/useChatStore.js';
import { useHandle } from '../contexts/HandleContext.jsx';
import { usePeer } from '../contexts/PeerContext.jsx';
import { useNetwork } from '../contexts/NetworkContext.jsx';

// Injected by Vite from package.json at build time.
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const StatusFooter = ({ onOpenModal }) => {
  const { handles, activeHandle, setActiveHandleId, declaration, setDeclaration } = useHandle();
  const { status } = usePeer();
  const { bridgeUrl } = useNetwork();
  const { theme, toggleTheme, presence } = useChatStore();
  const [showHandlesList, setShowHandlesList] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);

  // Phone-width footer: drop the informational text (bridge host, version
  // string, member breakdown words) so the interactive controls fit on one
  // row. Same 800px threshold as ChatShell's tab layout.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 800);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 800);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleDeclaration = () => {
    setDeclaration(declaration === 'human' ? 'agent' : 'human');
  };

  // Filter peers active in the last 90 seconds
  const now = Date.now();
  const activePeers = Object.entries(presence)
    .map(([id, info]) => ({ id, ...info }))
    .filter(p => now - p.lastSeen < 90000);

  const humans = activePeers.filter(p => p.declaration === 'human');
  const agents = activePeers.filter(p => p.declaration === 'agent');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '42px',
      padding: '0 1rem',
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--border-color)',
      fontSize: '0.78rem',
      position: 'relative',
      zIndex: 10,
      color: 'var(--color-text)'
    }}>
      {/* Left side: Mesh status, active persona dropdown, declaration, theme toggle, QR code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.8rem', position: 'relative', minWidth: 0 }}>
        {/* Connection Dot */}
        <div
          title="Your connection to the Axona network — green means you're online and messages flow"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: status.ready ? '#2ecc71' : '#f1c40f',
            display: 'inline-block'
          }} />
          {!isMobile && (
            <span style={{ color: 'var(--color-text)', fontWeight: '500' }}>
              {status.reason === 'connecting' ? 'Connecting...' : status.ready ? 'Online' : 'Seeking Peers'}
            </span>
          )}
          {!isMobile && (
            <span style={{ color: 'var(--color-muted)', fontSize: '0.7rem' }}>
              ({bridgeUrl.replace('wss://', '').replace('https://', '')})
            </span>
          )}
          <span
            title="Application version · Axona protocol kernel version"
            style={{ color: 'var(--color-muted)', fontSize: '0.68rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}
          >
            v{APP_VERSION} · kernel {KERNEL_VERSION}
          </span>
        </div>

        {!isMobile && <span style={{ color: 'var(--border-color)', opacity: 0.5 }}>|</span>}

        {/* Persona Dropdown Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowHandlesList(!showHandlesList)}
            title="Your persona — the name and signing key your messages are sent under. Click to switch personas or create a new one"
            style={{
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: 'var(--color-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--color-text)',
              maxWidth: isMobile ? '110px' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            👤 {activeHandle ? activeHandle.name : 'Persona'} <span style={{ fontSize: '0.6rem' }}>▼</span>
          </button>

          {showHandlesList && (
            <div className="glass" style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              zIndex: 30,
              background: 'var(--color-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              marginBottom: '6px',
              minWidth: '170px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              color: 'var(--color-text)'
            }}>
              {handles.map(h => (
                <div
                  key={h.id}
                  onClick={() => {
                    setActiveHandleId(h.id);
                    setShowHandlesList(false);
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: activeHandle?.id === h.id ? 'var(--color-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>{h.name}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-muted)' }}>{h.authorId.slice(0, 10)}...</div>
                </div>
              ))}
              <div 
                onClick={() => {
                  setShowHandlesList(false);
                  onOpenModal('handles');
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-primary-light)',
                  textAlign: 'center',
                  background: 'var(--color-bg)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                + Manage Personas
              </div>
            </div>
          )}
        </div>

        {/* Declaration Switcher */}
        <button
          onClick={toggleDeclaration}
          style={{
            padding: '0.2rem 0.5rem',
            fontSize: '0.72rem',
            fontWeight: '600',
            background: declaration === 'human' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(155, 89, 182, 0.15)',
            color: declaration === 'human' ? '#3498db' : '#9b59b6',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer'
          }}
          title="Are you a human or an AI agent? Your choice is shown on every message you send, so others know who they're talking to — click to switch"
        >
          {declaration === 'human' ? '🙋‍♂️ Human' : '🤖 Agent'}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            padding: '0.2rem 0.4rem',
            fontSize: '0.75rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--color-text)'
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>

        {/* Share/QR button */}
        <button
          onClick={() => onOpenModal('share')}
          style={{
            padding: '0.2rem 0.4rem',
            fontSize: '0.75rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--color-text)'
          }}
          title="Start a private conversation: shows a QR code and link that open an encrypted one-to-one channel with whoever uses it"
        >
          🔗{!isMobile && ' QR Link'}
        </button>
      </div>

      {/* Right side: Active participants classification summary */}
      <div style={{ position: 'relative' }}>
        <span
          onClick={() => setShowParticipantsList(!showParticipantsList)}
          title="Who's here right now, by their declared class — click for the list"
          style={{
            color: 'var(--color-muted)',
            cursor: 'pointer',
            fontWeight: '500',
            userSelect: 'none'
          }}
        >
          {isMobile
            ? `👥 ${humans.length}·${agents.length}`
            : `👥 Members: ${humans.length} Humans | ${agents.length} Agents`}
        </span>

        {showParticipantsList && (
          <div className="glass" style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            zIndex: 30,
            background: 'var(--color-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            padding: '0.8rem',
            marginBottom: '6px',
            minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            color: 'var(--color-text)'
          }}>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 'bold', color: '#3498db', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Humans ({humans.length})
              </div>
              {humans.length === 0 ? (
                <div style={{ fontStyle: 'italic', fontSize: '0.7rem', color: 'var(--color-muted)' }}>None active</div>
              ) : (
                humans.map(h => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: '500' }}>{h.handle}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)' }}>{h.id.slice(0, 8)}</span>
                  </div>
                ))
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 'bold', color: '#9b59b6', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Agents ({agents.length})
              </div>
              {agents.length === 0 ? (
                <div style={{ fontStyle: 'italic', fontSize: '0.7rem', color: 'var(--color-muted)' }}>None active</div>
              ) : (
                agents.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: '500', color: '#9b59b6' }}>{a.handle}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)' }}>{a.id.slice(0, 8)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusFooter;
