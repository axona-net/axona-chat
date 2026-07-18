import React, { useState } from 'react';
import { useChatStore } from '../stores/useChatStore.js';
import AxonaChatClient from '../services/AxonaChatClient.js';

const TopicTicker = () => {
  const { advertisedTopics, tickerVisible, setTickerVisible, addTopic, setActiveTopic } = useChatStore();
  const [isPaused, setIsPaused] = useState(false);

  const handleToggle = () => {
    const next = !tickerVisible;
    setTickerVisible(next);
    // Triggers resubscribe / unsubscribe in client
    AxonaChatClient.reconcileSubscriptions();
  };

  const handleOpenAd = (ad) => {
    const descriptor = {
      region: ad.region,
      name: ad.name,
      owner: ad.owner || undefined,
      mode: ad.mode,
      // Prefer the write policy carried in the ad — it is part of the topic id.
      write: ad.write || (ad.mode === 'open' ? 'open' : 'owner')
    };
    addTopic(descriptor);
    setActiveTopic(descriptor);
    AxonaChatClient.reconcileSubscriptions();
  };

  if (!tickerVisible) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.4rem 1rem',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.8rem',
        justifyContent: 'space-between'
      }}>
        <span style={{ color: 'var(--color-muted)' }}>Discovery ticker hidden.</span>
        <button 
          onClick={handleToggle} 
          style={{ padding: '0.1rem 0.5rem', fontSize: '0.75rem', background: 'var(--color-primary-dark)' }}
        >
          Show Discovery Ticker
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0.4rem 1rem',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--border-color)',
      overflow: 'hidden',
      position: 'relative',
      fontSize: '0.8rem',
      gap: '1rem'
    }}>
      <span style={{
        fontWeight: 'bold',
        color: 'var(--color-primary)',
        whiteSpace: 'nowrap',
        zIndex: 2,
        background: 'var(--color-surface)',
        paddingRight: '0.5rem'
      }}>
        DISCOVER:
      </span>

      <div 
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          whiteSpace: 'nowrap',
          position: 'relative',
          cursor: 'pointer'
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div style={{
          display: 'inline-flex',
          gap: '2.5rem',
          animation: 'ticker-scroll 25s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
          paddingLeft: '100%'
        }}>
          {advertisedTopics.length === 0 ? (
            <span style={{ color: 'var(--color-muted)' }}>No topics advertised yet. Create a topic and advertise it!</span>
          ) : (
            advertisedTopics.map((ad, idx) => (
              <div 
                key={`${ad.topicId}-${idx}`} 
                onClick={() => handleOpenAd(ad)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.1rem 0.6rem',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.05)',
                  transition: 'background 0.2s',
                  fontSize: '0.78rem'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>#{ad.name}</span>
                <span style={{ color: 'var(--color-muted)' }}>– {ad.blurb}</span>
                <span style={{ 
                  fontSize: '0.65rem', 
                  padding: '1px 4px', 
                  borderRadius: '3px', 
                  background: ad.mode === 'moderated' ? '#e67e22' : ad.mode === 'controlled' ? '#9b59b6' : 'rgba(255,255,255,0.1)',
                  color: '#fff'
                }}>
                  {ad.mode}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <button 
        onClick={handleToggle} 
        style={{
          padding: '0.1rem 0.4rem',
          fontSize: '0.7rem',
          background: 'rgba(255,255,255,0.05)',
          border: 'none',
          cursor: 'pointer',
          zIndex: 2
        }}
      >
        Hide
      </button>

      {/* Embedded CSS for Ticker animation */}
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default TopicTicker;
