import React, { useState } from 'react';
import { useChatStore } from '../stores/useChatStore.js';
import AxonaChatClient from '../services/AxonaChatClient.js';

const TopicTicker = () => {
  const { advertisedTopics, tickerVisible, setTickerVisible, addTopic, setActiveTopic, currentHandle } = useChatStore();
  const [isPaused, setIsPaused] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  // Two-step inline confirm for ad retraction (msgId of the ad being confirmed)
  const [confirmRetract, setConfirmRetract] = useState(null);

  const handleRetractAd = async (ad) => {
    try {
      await AxonaChatClient.retractAdvertisement(ad);
    } catch (err) {
      alert('ad retraction failed: ' + err.message);
    } finally {
      setConfirmRetract(null);
    }
  };

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
      // NO overflow:hidden here — the DISCOVER browse panel drops below this
      // bar via position:absolute and would be clipped invisible. The
      // scrolling ticker strip clips itself (its own overflow:hidden below).
      position: 'relative',
      fontSize: '0.8rem',
      gap: '1rem'
    }}>
      {/* DISCOVER is a button: opens a scrollable browse panel of all
          currently advertised topics (the ticker shows the same ads in
          motion; the panel lets you read and pick at leisure). */}
      <button
        onClick={() => setShowBrowse(!showBrowse)}
        title="Browse all advertised topics"
        style={{
          fontWeight: 'bold',
          color: 'var(--color-primary)',
          whiteSpace: 'nowrap',
          zIndex: 2,
          background: 'var(--color-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '0.1rem 0.5rem',
          cursor: 'pointer',
          fontSize: '0.78rem'
        }}
      >
        DISCOVER {showBrowse ? '▲' : '▼'}
      </button>

      {showBrowse && (
        <div className="glass" style={{
          position: 'absolute',
          top: '100%',
          left: '0.5rem',
          zIndex: 40,
          marginTop: '4px',
          width: 'min(420px, calc(100vw - 1rem))',
          maxHeight: '320px',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          padding: '0.4rem'
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--color-muted)', padding: '0.2rem 0.4rem', textTransform: 'uppercase' }}>
            Advertised topics ({advertisedTopics.length})
          </div>
          {advertisedTopics.length === 0 ? (
            <div style={{ padding: '0.6rem 0.4rem', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
              No topics advertised yet. Create a topic and advertise it!
            </div>
          ) : (
            [...advertisedTopics]
              .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))
              .map((ad, idx) => (
                <div
                  key={`browse-${ad.topicId}-${idx}`}
                  onClick={() => { handleOpenAd(ad); setShowBrowse(false); }}
                  style={{
                    padding: '0.45rem 0.4rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-text)', fontSize: '0.82rem' }}>#{ad.name}</span>
                    <span style={{
                      fontSize: '0.62rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: ad.mode === 'moderated' ? '#e67e22' : 'rgba(127,127,127,0.25)',
                      color: ad.mode === 'moderated' ? '#fff' : 'var(--color-text)'
                    }}>
                      {ad.mode}
                    </span>
                    {/* Retract control — only on ads the ACTIVE persona signed
                        (mirrors §11 message retraction: authority follows the
                        key). stopPropagation so it doesn't join the topic. */}
                    {ad.signer && currentHandle && ad.signer === currentHandle.authorId && (
                      confirmRetract === ad.msgId ? (
                        <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
                          <span style={{ color: 'var(--color-muted)', fontSize: '0.65rem' }}>Retract ad?</span>
                          <button onClick={() => handleRetractAd(ad)} style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '3px', padding: '0 5px', fontSize: '0.62rem', cursor: 'pointer', fontWeight: '600' }}>Yes</button>
                          <button onClick={() => setConfirmRetract(null)} style={{ background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '0 5px', fontSize: '0.62rem', cursor: 'pointer' }}>No</button>
                        </span>
                      ) : (
                        <span
                          onClick={(e) => { e.stopPropagation(); setConfirmRetract(ad.msgId); }}
                          title="Retract this advertisement (yours)"
                          style={{ marginLeft: 'auto', color: '#e74c3c', cursor: 'pointer', fontSize: '0.72rem' }}
                        >
                          ✕
                        </span>
                      )
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '2px' }}>{ad.blurb}</div>
                </div>
              ))
          )}
        </div>
      )}

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
