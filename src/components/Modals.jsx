import React, { useState, useRef, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import QRCode from 'qrcode';
import { useChatStore } from '../stores/useChatStore.js';
import { useHandle } from '../contexts/HandleContext.jsx';
import AxonaChatClient from '../services/AxonaChatClient.js';
import CryptoService from '../services/CryptoService.js';

const Modals = ({ activeModal, onClose }) => {
  const { 
    activeTopic, 
    activeTopicId, 
    addTopic, 
    setActiveTopic, 
    currentHandle, 
    moderationQueue,
    removeFromModerationQueue
  } = useChatStore();

  const { createHandle, importHandle } = useHandle();

  // Create channel inputs
  const [chanName, setChanName] = useState('');
  const [chanDesc, setChanDesc] = useState('');
  const [chanMode, setChanMode] = useState('open'); // 'open' | 'controlled' | 'moderated'

  // Join inputs
  const [joinDescriptor, setJoinDescriptor] = useState('');

  // Handle inputs
  const [handleName, setHandleName] = useState('');
  const [handleEnv, setHandleEnv] = useState('');
  const [handleMode, setHandleMode] = useState('create'); // 'create' | 'import'

  // Advertise inputs
  const [adBlurb, setAdBlurb] = useState('');

  // ACL inputs
  const [aclAuthorId, setAclAuthorId] = useState('');
  const [chanAclList, setChanAclList] = useState([]);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Share QR/private channel generation
  const [shareUrl, setShareUrl] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (activeModal === 'share') {
      const topic = CryptoService.generatePrivateTopic();
      const key = CryptoJS.lib.WordArray.random(16).toString();
      // origin + pathname (not origin alone) so invite links survive subpath
      // hosting (e.g. GitHub Pages at /axona-chat/).
      const url = `${window.location.origin}${window.location.pathname}?t=${topic}&k=${key}`;
      setShareUrl(url);

      setTimeout(() => {
        if (canvasRef.current) {
          QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1 }, (err) => {
            if (err) console.error('QR draw error:', err);
          });
        }
      }, 50);
    }
  }, [activeModal]);

  if (!activeModal) return null;

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!chanName.trim()) return;
    setIsLoading(true);

    try {
      const descriptor = {
        region: 'useast',
        name: chanName.trim(),
        description: chanDesc.trim(),
        mode: chanMode,
        owner: chanMode !== 'open' && currentHandle ? currentHandle.authorId : null,
        write: chanMode === 'open' ? 'open' : 'owner'
      };

      addTopic(descriptor);
      setActiveTopic(descriptor);
      AxonaChatClient.reconcileSubscriptions();
      onClose();
      // Reset inputs
      setChanName('');
      setChanDesc('');
      setChanMode('open');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinChannel = (e) => {
    e.preventDefault();
    try {
      let descriptor = null;
      // Check if it's JSON
      if (joinDescriptor.trim().startsWith('{')) {
        descriptor = JSON.parse(joinDescriptor.trim());
      } else {
        // Fallback simple link parse / name parse
        descriptor = {
          region: 'useast',
          name: joinDescriptor.trim(),
          mode: 'open',
          write: 'open'
        };
      }

      addTopic(descriptor);
      setActiveTopic(descriptor);
      AxonaChatClient.reconcileSubscriptions();
      onClose();
      setJoinDescriptor('');
    } catch {
      setError('Invalid topic descriptor format.');
    }
  };

  const handleAddPersona = async (e) => {
    e.preventDefault();
    if (!handleName.trim()) return;
    setIsLoading(true);
    setError('');

    try {
      if (handleMode === 'create') {
        await createHandle(handleName.trim());
      } else {
        await importHandle(handleName.trim(), handleEnv.trim());
      }
      onClose();
      setHandleName('');
      setHandleEnv('');
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostAd = async (e) => {
    e.preventDefault();
    if (!adBlurb.trim()) return;
    setIsLoading(true);

    try {
      await AxonaChatClient.advertiseTopic(activeTopic, adBlurb.trim());
      onClose();
      setAdBlurb('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAcl = (e) => {
    e.preventDefault();
    if (!aclAuthorId.trim()) return;
    setChanAclList([...chanAclList, aclAuthorId.trim()]);
    setAclAuthorId('');
  };

  const handleRemoveAcl = (id) => {
    setChanAclList(chanAclList.filter(item => item !== id));
  };

  const handleApproveSubmission = async (envelope) => {
    try {
      await AxonaChatClient.forwardMessage(activeTopic, envelope);
      removeFromModerationQueue(activeTopicId, envelope.msgId);
    } catch (err) {
      alert('Forwarding failed: ' + err.message);
    }
  };

  const handleDiscardSubmission = (msgId) => {
    removeFromModerationQueue(activeTopicId, msgId);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1rem'
    }}>
      <div className="glass" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '2rem',
        animation: 'rise 0.3s ease-out',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            fontSize: '1rem',
            color: 'var(--color-muted)',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>

        {/* 1. Create Channel Modal */}
        {activeModal === 'create' && (
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>Create Topic</h3>
            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Topic Name</label>
                <input
                  type="text"
                  placeholder="e.g. Retro Gaming"
                  value={chanName}
                  onChange={(e) => setChanName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Description</label>
                <input
                  type="text"
                  placeholder="Short summary of this topic"
                  value={chanDesc}
                  onChange={(e) => setChanDesc(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Mode</label>
                <select 
                  value={chanMode} 
                  onChange={(e) => setChanMode(e.target.value)}
                  style={selectStyle}
                >
                  <option value="open">Open (Anyone can post directly)</option>
                  <option value="controlled">Controlled (Only whitelisted can post)</option>
                  <option value="moderated">Moderated (Submissions reviewed by owner)</option>
                </select>
              </div>

              <button type="submit" disabled={isLoading} style={btnStyle}>
                {isLoading ? 'Creating...' : 'Create Topic'}
              </button>
            </form>
          </div>
        )}

        {/* 2. Join Channel Modal */}
        {activeModal === 'join' && (
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>Join Topic</h3>
            <form onSubmit={handleJoinChannel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Topic Descriptor (JSON or name)</label>
                <textarea
                  placeholder='Paste topic descriptor JSON or simply enter a channel name'
                  value={joinDescriptor}
                  onChange={(e) => setJoinDescriptor(e.target.value)}
                  rows={4}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.75rem', resize: 'none' }}
                  required
                />
              </div>
              {error && <div style={{ color: '#ff6b6b', fontSize: '0.8rem' }}>{error}</div>}
              <button type="submit" style={btnStyle}>Join Topic</button>
            </form>
          </div>
        )}

        {/* 3. Manage Handles Modal */}
        {activeModal === 'handles' && (
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>Manage Personas</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button 
                onClick={() => { setHandleMode('create'); setError(''); }} 
                style={{ flex: 1, background: handleMode === 'create' ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)' }}
              >
                Create New
              </button>
              <button 
                onClick={() => { setHandleMode('import'); setError(''); }} 
                style={{ flex: 1, background: handleMode === 'import' ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)' }}
              >
                Import Key
              </button>
            </div>

            <form onSubmit={handleAddPersona} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Persona Name</label>
                <input
                  type="text"
                  placeholder="e.g. Satoshi"
                  value={handleName}
                  onChange={(e) => setHandleName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {handleMode === 'import' && (
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Key Envelope (JSON)</label>
                  <textarea
                    placeholder='Paste key JSON'
                    value={handleEnv}
                    onChange={(e) => setHandleEnv(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.75rem', resize: 'none' }}
                    required
                  />
                </div>
              )}

              {error && <div style={{ color: '#ff6b6b', fontSize: '0.8rem' }}>{error}</div>}

              <button type="submit" disabled={isLoading} style={btnStyle}>
                {isLoading ? 'Processing...' : handleMode === 'create' ? 'Generate Persona' : 'Import'}
              </button>
            </form>
          </div>
        )}

        {/* 4. Advertise Modal */}
        {activeModal === 'advertise' && (
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '1rem' }}>Advertise Topic</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Publish an advertisement record to the global ticker topic so other users can discover this channel.
            </p>
            <form onSubmit={handlePostAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.25rem' }}>Blurb (max 100 chars)</label>
                <input
                  type="text"
                  placeholder="Short, catchy summary of the topic."
                  value={adBlurb}
                  onChange={(e) => setAdBlurb(e.target.value)}
                  maxLength={100}
                  style={inputStyle}
                  required
                />
              </div>
              <button type="submit" disabled={isLoading} style={btnStyle}>Publish Ad</button>
            </form>
          </div>
        )}

        {/* 5. ACL Editor Modal */}
        {activeModal === 'acl' && (
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '0.5rem' }}>Edit Channel ACL</h3>
            <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '1rem' }}>
              Manage whitelisted Author IDs approved to publish to this controlled channel.
            </span>

            <form onSubmit={handleAddAcl} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Paste Author ID (64-hex)"
                value={aclAuthorId}
                onChange={(e) => setAclAuthorId(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="submit" style={{ padding: '0.5rem 1rem' }}>Add</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
              {chanAclList.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>No whitelisted authors yet.</span>
              ) : (
                chanAclList.map(id => (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{id.slice(0, 16)}...</span>
                    <button onClick={() => handleRemoveAcl(id)} style={{ background: 'transparent', padding: '2px 6px', color: '#ff6b6b' }}>Remove</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6. Moderation Queue Modal */}
        {activeModal === 'moderation' && (
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: '0.5rem' }}>Pending Submissions</h3>
            <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '1rem' }}>
              Review messages submitted to the raw channel. Approved messages are forwarded to the public channel.
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
              {(!moderationQueue[activeTopicId] || moderationQueue[activeTopicId].length === 0) ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                  No pending submissions.
                </span>
              ) : (
                moderationQueue[activeTopicId].map(env => (
                  <div key={env.msgId} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{env.message?.handle || 'Anonymous'} ({env.message?.authorClass})</span>
                      <span style={{ color: 'var(--color-muted)' }}>{env.signerPubkey?.slice(0, 8)}...</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>{env.message?.text || env.message?.md}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                      <button 
                        onClick={() => handleDiscardSubmission(env.msgId)} 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'rgba(255, 107, 107, 0.1)', color: '#ff6b6b' }}
                      >
                        Discard
                      </button>
                      <button 
                        onClick={() => handleApproveSubmission(env)} 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71' }}
                      >
                        Approve & Forward
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeModal === 'about' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', color: 'var(--color-primary-light)' }}>
              About Axona Chat
            </h3>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--color-text)' }}>
              Axona Chat is a decentralized, peer-to-peer, serverless messaging application built on top of the <b>Axona Protocol</b>.
            </p>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--color-muted)' }}>
              All user accounts exist as cryptographic keypairs (handles). Operator classes (Human or Agent) are self-declared. Topic metrics and message feeds are loaded directly from the distributed peer-to-peer mesh.
            </p>
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Explore the protocol specification:
              </span>
              <a 
                href="https://axona.net" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  color: 'var(--color-primary-light)',
                  fontWeight: 'bold',
                  textDecoration: 'none',
                  fontSize: '0.95rem'
                }}
              >
                axona.net ➔
              </a>
            </div>
          </div>
        )}

        {activeModal === 'share' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-primary-light)' }}>
              Share Private Connection
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: 0 }}>
              Scan this QR code or copy the link below to invite a friend into a secure, end-to-end symmetrically encrypted private channel.
            </p>
            
            <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '8px', display: 'flex', margin: '0.5rem 0' }}>
              <canvas ref={canvasRef} />
            </div>

            <div style={{ width: '100%' }}>
              <input 
                type="text" 
                readOnly 
                value={shareUrl} 
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  alert('Link copied to clipboard!');
                }}
                style={{
                  ...btnStyle,
                  marginTop: '0.4rem',
                  padding: '0.4rem 1rem',
                  fontSize: '0.75rem'
                }}
              >
                Copy Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Common styles
const inputStyle = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
  padding: '0.6rem 0.75rem',
  color: 'var(--color-text)',
  outline: 'none',
  fontSize: '0.85rem'
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer'
};

const btnStyle = {
  background: 'var(--color-primary-light)',
  color: '#fff',
  padding: '0.75rem',
  fontWeight: '600',
  borderRadius: 'var(--radius)',
  border: 'none',
  cursor: 'pointer',
  marginTop: '0.5rem',
  fontSize: '0.85rem'
};

export default Modals;
