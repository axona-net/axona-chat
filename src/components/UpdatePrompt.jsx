import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// The update alert. useRegisterSW registers the service worker (built by
// vite-plugin-pwa) and exposes `needRefresh` — flipped true when a newer
// deploy has been fetched and is waiting. We surface a small toast; the reload
// only happens when the user clicks (registerType 'prompt'). In dev the SW is
// disabled, so needRefresh stays false and nothing renders.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly re-check while a tab stays open

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Long-lived tabs won't otherwise notice a deploy until reopened; poll
      // the SW so the toast can appear the same day.
      setInterval(() => registration.update(), CHECK_INTERVAL_MS);
    }
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '54px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        padding: '0.7rem 1rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '999px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        fontSize: '0.82rem',
        color: 'var(--color-text)',
        maxWidth: 'calc(100vw - 2rem)'
      }}
    >
      <span>✨ A new version of Axona Chat is available.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        title="Reload to load the latest version"
        style={{
          padding: '0.3rem 0.9rem',
          fontWeight: '700',
          fontSize: '0.8rem',
          border: 'none',
          borderRadius: '999px',
          background: 'var(--color-primary)',
          color: '#fff',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        title="Dismiss — you can reload later"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-muted)',
          cursor: 'pointer',
          fontSize: '0.9rem',
          lineHeight: 1
        }}
      >
        ✕
      </button>
    </div>
  );
};

export default UpdatePrompt;
