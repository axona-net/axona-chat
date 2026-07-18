// src/components/LinkPreview.jsx
import React, { useState, useEffect } from 'react';
import LinkPreviewService from '../services/LinkPreviewService.js';

const LinkPreview = ({ url }) => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    LinkPreviewService.fetchPreview(url)
      .then((data) => {
        if (active) {
          setMetadata(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 0.8rem',
        background: 'var(--color-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginTop: '0.4rem',
        maxWidth: '520px',
        animation: 'pulse 1.5s infinite ease-in-out'
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ width: '40%', height: '10px', background: 'var(--border-color)', borderRadius: '2px' }} />
          <div style={{ width: '80%', height: '14px', background: 'var(--border-color)', borderRadius: '3px' }} />
          <div style={{ width: '95%', height: '10px', background: 'var(--border-color)', borderRadius: '2px' }} />
        </div>
        <div style={{ width: '60px', height: '60px', background: 'var(--border-color)', borderRadius: '4px' }} />
      </div>
    );
  }

  if (!metadata || !metadata.title) return null;

  const { title, description, image, logo, publisher } = metadata;

  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '0.75rem',
        padding: '0.6rem 0.8rem',
        background: 'var(--color-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginTop: '0.4rem',
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        maxWidth: '520px',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
      }}
    >
      {/* Main Metadata Text Details */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden' }}>
        
        {/* Publisher Favicon + Domain name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {logo && (
            <img 
              src={logo} 
              alt=""
              style={{ width: '14px', height: '14px', objectFit: 'contain', borderRadius: '2px' }}
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <span style={{ 
            fontSize: '0.62rem', 
            fontWeight: '700', 
            color: 'var(--color-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px' 
          }}>
            {publisher}
          </span>
        </div>

        {/* Title */}
        <h4 style={{ 
          fontSize: '0.82rem', 
          fontWeight: '700', 
          color: 'var(--color-primary)', 
          margin: 0,
          lineHeight: '1.25',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {title}
        </h4>

        {/* Description */}
        {description && (
          <p style={{ 
            fontSize: '0.72rem', 
            color: 'var(--color-muted)', 
            margin: 0,
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {description}
          </p>
        )}
      </div>

      {/* Thumbnail Image */}
      {image && (
        <div style={{ width: '64px', height: '64px', overflow: 'hidden', borderRadius: '4px', alignSelf: 'center', flexShrink: 0 }}>
          <img 
            src={image} 
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => e.target.parentNode.style.display = 'none'}
          />
        </div>
      )}
    </a>
  );
};

export default LinkPreview;
