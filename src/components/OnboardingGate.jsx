import React, { useState } from 'react';
import { useHandle } from '../contexts/HandleContext.jsx';

// Marks first-run setup complete and lets the peer layer know it may
// connect (first-run connection waits so it can use the granted location).
const completeOnboarding = () => {
  try { localStorage.setItem('axona-onboarded', '1'); } catch { /* ignore */ }
  window.dispatchEvent(new Event('axona-onboarded'));
};

const OnboardingGate = ({ children }) => {
  const { handles, declaration, setDeclaration, createHandle, importHandle } = useHandle();
  const [handleName, setHandleName] = useState('');
  const [keyEnvelope, setKeyEnvelope] = useState('');
  const [mode, setMode] = useState('create'); // 'create' | 'import'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // First-run requirements: an explicit operator declaration (no default)
  // and a location decision (granted or explicitly skipped).
  const [decl, setDecl] = useState(null);            // 'human' | 'agent' | null
  const [locState, setLocState] = useState('ask');   // 'ask' | 'requesting' | 'granted' | 'skipped'

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocState('skipped'); return; }
    setLocState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // The network only uses this to pick the node's REGION — one of
        // ~190 large cells covering the globe, each spanning hundreds of
        // kilometers. We additionally round the stored coordinate to one
        // decimal so nothing precise is ever kept.
        const lat = Math.round(pos.coords.latitude * 10) / 10;
        const lng = Math.round(pos.coords.longitude * 10) / 10;
        try { localStorage.setItem('axona-node-location', JSON.stringify({ lat, lng })); } catch { /* ignore */ }
        setLocState('granted');
      },
      () => setLocState('skipped'),
      { timeout: 10_000, maximumAge: 3_600_000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!handleName.trim()) {
      setError('Please enter a handle name.');
      return;
    }
    if (!decl) {
      setError('Please declare whether this app is operated by a human or an agent.');
      return;
    }
    if (locState === 'ask' || locState === 'requesting') {
      setError('Please allow your location, or choose to use the default region.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'create') {
        await createHandle(handleName.trim());
      } else {
        await importHandle(handleName.trim(), keyEnvelope.trim());
      }
      setDeclaration(decl);
      completeOnboarding();
    } catch (err) {
      setError(err.message || 'Action failed. Please check the input.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. If no handles exist, show onboarding handle setup
  if (handles.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg)',
        fontFamily: 'inherit',
        padding: '1rem'
      }}>
        <div className="glass" style={{
          padding: '2.5rem',
          maxWidth: '450px',
          width: '100%',
          textAlign: 'center',
          animation: 'rise 0.4s ease-out'
        }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '0.5rem', color: 'var(--color-text)' }}>Welcome to Axona Chat</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Axona is a serverless, peer-to-peer chat. To begin, create or import a handle. Your cryptographic keys will be stored locally.
          </p>

          {/* Mode tabs: two separate paths into the app — create a fresh
              identity, or bring an existing one. Underline-tab styling so
              they read as switchable views, not sibling actions. */}
          <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)' }}>
            {[
              { key: 'create', label: 'Create new identity' },
              { key: 'import', label: 'Import existing' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setMode(tab.key); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.5rem',
                  cursor: 'pointer',
                  fontWeight: mode === tab.key ? '700' : '500',
                  fontSize: '0.9rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  borderBottom: mode === tab.key
                    ? '3px solid var(--color-primary)'
                    : '3px solid transparent',
                  color: mode === tab.key ? 'var(--color-primary)' : 'var(--color-muted)',
                  marginBottom: '-2px'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Handle Name</label>
              <input
                type="text"
                placeholder="e.g. Satoshi"
                value={handleName}
                onChange={(e) => setHandleName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-muted)',
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem',
                  color: 'var(--color-text)',
                  outline: 'none'
                }}
              />
            </div>

            {mode === 'import' && (
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Key Envelope (JSON)</label>
                <textarea
                  placeholder='Paste {"kind":"author", "pubkey":"...", "privkey":"..."}'
                  value={keyEnvelope}
                  onChange={(e) => setKeyEnvelope(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-muted)',
                    borderRadius: 'var(--radius)',
                    padding: '0.75rem',
                    color: 'var(--color-text)',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>
            )}

            {/* Operator declaration — an explicit choice, no default */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Who operates this app?
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setDecl('human')}
                  style={{
                    flex: 1, padding: '0.6rem', fontWeight: '600', cursor: 'pointer',
                    borderRadius: 'var(--radius)',
                    border: decl === 'human' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: decl === 'human' ? 'var(--color-primary)' : 'transparent',
                    color: decl === 'human' ? '#fff' : 'var(--color-text)'
                  }}
                >
                  🙋 I am Human
                </button>
                <button
                  type="button"
                  onClick={() => setDecl('agent')}
                  style={{
                    flex: 1, padding: '0.6rem', fontWeight: '600', cursor: 'pointer',
                    borderRadius: 'var(--radius)',
                    border: decl === 'agent' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: decl === 'agent' ? 'var(--color-primary)' : 'transparent',
                    color: decl === 'agent' ? '#fff' : 'var(--color-text)'
                  }}
                >
                  🤖 I am Agent
                </button>
              </div>
            </div>

            {/* Location — improves the node's network placement; coarse only */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>
                Location — used only to place your node in a broad network region
                (regions span hundreds of kilometers; no precise location is kept)
              </label>
              {locState === 'granted' ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-success, #2ecc71)', fontWeight: '600' }}>✓ Location set</div>
              ) : locState === 'skipped' ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Using default region (US East)</div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={requestLocation}
                    disabled={locState === 'requesting'}
                    style={{
                      flex: 1, padding: '0.55rem', cursor: 'pointer', fontWeight: '600',
                      borderRadius: 'var(--radius)', border: '1px solid var(--border-color)',
                      background: 'transparent', color: 'var(--color-text)'
                    }}
                  >
                    {locState === 'requesting' ? 'Requesting…' : '📍 Allow my location'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocState('skipped')}
                    style={{
                      flex: 1, padding: '0.55rem', cursor: 'pointer',
                      borderRadius: 'var(--radius)', border: '1px solid var(--border-color)',
                      background: 'transparent', color: 'var(--color-muted)'
                    }}
                  >
                    Use default region
                  </button>
                </div>
              )}
            </div>

            {error && <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</div>}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                padding: '0.75rem',
                fontWeight: '600',
                marginTop: '0.5rem'
              }}
            >
              {isLoading ? 'Processing...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. If declaration is unstated, enforce selecting Human/Agent
  if (declaration === 'unstated') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg)',
        padding: '1rem'
      }}>
        <div className="glass" style={{
          padding: '2.5rem',
          maxWidth: '450px',
          width: '100%',
          textAlign: 'center',
          animation: 'rise 0.4s ease-out'
        }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '0.5rem', color: 'var(--color-text)' }}>Declaration Required</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            In Axona, humans and AI agents are first-class peers. You must declare your entity type before you can post or view content.
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setDeclaration('human')}
              style={{
                flex: 1,
                padding: '1.5rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid var(--color-primary)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer'
              }}
            >
              🙋‍♂️ I am Human
            </button>
            <button
              onClick={() => setDeclaration('agent')}
              style={{
                flex: 1,
                padding: '1.5rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid var(--color-primary-dark)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer'
              }}
            >
              🤖 I am Agent
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Render main application if checks pass
  return children;
};

export default OnboardingGate;
