import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../stores/useChatStore.js';
import AxonaChatClient from '../services/AxonaChatClient.js';
import LinkPreview from './LinkPreview.jsx';

const Message = ({ envelope, activeTopic, onReply, onPrivateReply, level = 0 }) => {
  const { msgId, signerPubkey, ts } = envelope;
  const payload = envelope.message;
  const { currentHandle } = useChatStore();

  if (!payload) return null;

  // 1. Declaration enforcement (§6.5)
  // Absence of declaration (or undeclared class) hides the message
  const hasDeclaration = payload.authorClass === 'human' || payload.authorClass === 'agent';
  if (!hasDeclaration) {
    return (
      <div style={{
        margin: '0.5rem 0',
        padding: '0.6rem 0.8rem',
        borderRadius: 'var(--radius)',
        background: 'rgba(255, 107, 107, 0.05)',
        borderLeft: '3px solid #ff6b6b',
        fontSize: '0.8rem',
        color: 'var(--color-muted)',
        animation: 'fadeIn 0.3s ease-out',
        marginLeft: `${level * 1.2}rem`
      }}>
        <i>hidden: author has not declared human/agent class ({signerPubkey?.slice(0, 8)})</i>
      </div>
    );
  }

  const isOwn = currentHandle && signerPubkey === currentHandle.authorId;
  const formattedTime = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const [showConfirm, setShowConfirm] = useState(false);

  // Handle Delete (Kill message)
  const handleDelete = async () => {
    try {
      await AxonaChatClient.deleteOwnMessage(activeTopic, msgId);
      // Optimistic removal
      useChatStore.getState().killMessage(useChatStore.getState().activeTopicId, msgId);
    } catch (err) {
      console.error('Retraction failed traceback:', err);
      alert('retraction failed: ' + err.message);
    }
  };

  // Helper to detect and render embedded URLs
  const renderEmbeds = (text) => {
    if (typeof text !== 'string') return null;

    // Match image extensions
    const imgRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|svg))/gi;
    const imgMatches = text.match(imgRegex);

    // Match youtube links
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
    const ytMatch = text.match(ytRegex);

    // Match general HTTP/HTTPS URLs (and exclude direct images/youtube links)
    const urlRegex = /https?:\/\/[^\s<>\"]+/gi;
    const allUrls = text.match(urlRegex) || [];
    const previewUrls = [...new Set(allUrls.filter(url => {
      const isImg = /\.(?:png|jpg|jpeg|gif|webp|svg)/i.test(url);
      const isYt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url);
      return !isImg && !isYt;
    }))];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        {imgMatches && imgMatches.map((url, idx) => (
          <div key={idx} style={{ maxWidth: '100%', maxHeight: '300px', overflow: 'hidden', borderRadius: '4px' }}>
            <img 
              src={url} 
              alt="Embedded" 
              style={{ maxWidth: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} 
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        ))}
        {ytMatch && (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px', maxWidth: '400px' }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytMatch[1]}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        )}
        {previewUrls.map((url, idx) => (
          <LinkPreview key={`link-${idx}`} url={url} />
        ))}
      </div>
    );
  };

  const displayText = payload.isEncrypted ? payload.decryptedText : payload.md || payload.text || '';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      padding: '0.75rem',
      borderRadius: 'var(--radius)',
      background: payload.isEncrypted 
        ? 'var(--color-success-bg)' 
        : 'var(--color-surface)',
      border: '1px solid var(--border-color)',
      borderLeft: payload.isEncrypted 
        ? '3px solid var(--color-success)' 
        : isOwn ? '3px solid var(--color-primary)' : '1px solid var(--border-color)',
      marginBottom: '0.5rem',
      marginLeft: `${level * 1.2}rem`,
      animation: 'rise 0.25s ease-out'
    }}>
      {/* Sender Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: isOwn ? 'var(--color-primary)' : 'var(--color-text)', fontSize: '0.85rem' }}>
            {payload.handle || 'Anonymous'}
          </span>
          
          {/* Badge declaration class */}
          <span style={{
            fontSize: '0.6rem',
            padding: '1px 5px',
            borderRadius: '10px',
            background: payload.authorClass === 'human' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(155, 89, 182, 0.15)',
            color: payload.authorClass === 'human' ? '#3498db' : '#9b59b6',
            fontWeight: '600'
          }}>
            {payload.authorClass === 'human' ? 'HUMAN' : 'AGENT'}
          </span>

          {payload.isEncrypted && (
            <span style={{
              fontSize: '0.6rem',
              padding: '1px 5px',
              borderRadius: '10px',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              🔒 PRIVATE
            </span>
          )}

          <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)' }}>
            {signerPubkey?.slice(0, 10)}...
          </span>
        </div>

        <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
          {formattedTime}
        </span>
      </div>

      <div className="message-content" style={{ fontSize: '0.9rem', lineHeight: '1.4', wordBreak: 'break-word', color: 'var(--color-text)' }}>
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          }}
        >
          {displayText}
        </ReactMarkdown>
        {renderEmbeds(displayText)}
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem', justifyContent: 'flex-end', fontSize: '0.7rem' }}>
        <span 
          onClick={() => onReply(envelope)} 
          style={{ color: 'var(--color-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = 'var(--color-primary)'}
          onMouseLeave={(e) => e.target.style.color = 'var(--color-muted)'}
        >
          Reply
        </span>

        {/* Can private-reply if not own message */}
        {!isOwn && (
          <span 
            onClick={() => onPrivateReply(envelope)} 
            style={{ color: 'var(--color-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--color-success)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--color-muted)'}
          >
            Private Reply
          </span>
        )}

        {/* Retraction option (Kill own message) */}
        {isOwn && (
          showConfirm ? (
            <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.68rem' }}>Confirm retract?</span>
              <button 
                onClick={handleDelete}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '1px 6px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Yes
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  padding: '0px 6px',
                  fontSize: '0.65rem',
                  cursor: 'pointer'
                }}
              >
                No
              </button>
            </span>
          ) : (
            <span 
              onClick={() => setShowConfirm(true)} 
              style={{ color: '#e74c3c', cursor: 'pointer' }}
            >
              Retract (✕)
            </span>
          )
        )}
      </div>
    </div>
  );
};

export default Message;
