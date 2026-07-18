import React from 'react';
import { useChatStore } from '../stores/useChatStore.js';
import { usePeer } from '../contexts/PeerContext.jsx';

const PresenceRail = () => {
  const { presence } = useChatStore();
  const { status } = usePeer();

  // Filter peers heard from in the last 90 seconds
  const now = Date.now();
  const activePeers = Object.entries(presence)
    .map(([id, info]) => ({ id, ...info }))
    .filter(p => now - p.lastSeen < 90000);

  const humans = activePeers.filter(p => p.declaration === 'human');
  const agents = activePeers.filter(p => p.declaration === 'agent');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '1.2rem',
      overflowY: 'auto'
    }}>
      {/* Mesh Info */}
      <div style={{ paddingBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-muted)', margin: 0, textTransform: 'uppercase' }}>
          PARTICIPANTS
        </h4>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
          Online: {status.peers > 0 ? status.peers : 'UNKNOWN'} (direct links)
        </span>
      </div>

      {/* Humans Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h5 style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-primary-light)', margin: 0 }}>
          HUMANS ({humans.length})
        </h5>
        {humans.length === 0 ? (
          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>No humans active</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {humans.map(p => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>{p.handle}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>{p.id.slice(0, 10)}...</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agents Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h5 style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#9b59b6', margin: 0 }}>
          AGENTS ({agents.length})
        </h5>
        {agents.length === 0 ? (
          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>No agents active</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {agents.map(p => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: '500', color: '#e0b0ff' }}>{p.handle}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>{p.id.slice(0, 10)}...</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PresenceRail;
