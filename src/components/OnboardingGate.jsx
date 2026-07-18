import React, { useState } from 'react';
import { useHandle } from '../contexts/HandleContext.jsx';

const OnboardingGate = ({ children }) => {
  const { handles, declaration, setDeclaration, createHandle, importHandle } = useHandle();
  const [handleName, setHandleName] = useState('');
  const [keyEnvelope, setKeyEnvelope] = useState('');
  const [mode, setMode] = useState('create'); // 'create' | 'import'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!handleName.trim()) {
      setError('Please enter a handle name.');
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

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => { setMode('create'); setError(''); }} 
              style={{ flex: 1, background: mode === 'create' ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)' }}
            >
              Generate New
            </button>
            <button 
              onClick={() => { setMode('import'); setError(''); }} 
              style={{ flex: 1, background: mode === 'import' ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)' }}
            >
              Import Handle
            </button>
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

            {error && <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{error}</div>}

            <button 
              type="submit" 
              disabled={isLoading}
              style={{
                background: 'var(--color-primary-light)',
                color: '#fff',
                padding: '0.75rem',
                fontWeight: '600',
                marginTop: '0.5rem'
              }}
            >
              {isLoading ? 'Processing...' : mode === 'create' ? 'Generate Identity' : 'Import'}
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
