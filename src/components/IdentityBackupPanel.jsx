import React, { useRef, useState } from 'react';
import { collectProfile, encryptBackup, decryptBackup, importProfile } from '../services/identityBackup.js';

const field = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-muted)',
  borderRadius: 'var(--radius)',
  padding: '0.55rem',
  color: 'var(--color-text)',
  outline: 'none',
  fontSize: '0.85rem'
};

const btn = (primary) => ({
  padding: '0.5rem 0.9rem',
  fontWeight: '600',
  fontSize: '0.82rem',
  borderRadius: 'var(--radius)',
  border: primary ? 'none' : '1px solid var(--border-color)',
  background: primary ? 'var(--color-primary)' : 'transparent',
  color: primary ? '#fff' : 'var(--color-text)',
  cursor: 'pointer'
});

// Whole-profile backup UI: export every persona + subscriptions into one
// password-encrypted file, and restore it on another browser. Lives inside
// Manage Personas because it is identity, not chat.
const IdentityBackupPanel = () => {
  const [mode, setMode] = useState('export'); // 'export' | 'import'

  // Export state
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  // Import state
  const [importPw, setImportPw] = useState('');
  const fileRef = useRef(null);
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleExport = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    if (pw.length < 8) { setError('Use a password of at least 8 characters — this file holds your private keys.'); return; }
    if (pw !== pw2) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      const text = await encryptBackup(pw, await collectProfile());
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'axona-identity-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPw(''); setPw2('');
      setNotice('Backup downloaded. Keep it somewhere safe — anyone with the file and its password gets your identities.');
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e) => {
    setError(''); setNotice('');
    const file = e.target.files?.[0];
    if (!file) { setFileText(''); setFileName(''); return; }
    try {
      setFileText(await file.text());
      setFileName(file.name);
    } catch {
      setError('Could not read that file.');
      setFileText(''); setFileName('');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    if (!fileText) { setError('Choose a backup file first.'); return; }
    if (!importPw) { setError('Enter the backup password.'); return; }
    setBusy(true);
    try {
      const profile = await decryptBackup(importPw, fileText);
      const { personasAdded, personasTotal } = await importProfile(profile);
      setNotice(`Restored ${personasAdded} new persona${personasAdded === 1 ? '' : 's'} (${personasTotal} total). Reloading…`);
      // Reload so HandleContext and the chat store re-read the merged storage.
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        Backup &amp; Restore
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
        <button type="button" onClick={() => { setMode('export'); setError(''); setNotice(''); }} style={btn(mode === 'export')}>
          Export
        </button>
        <button type="button" onClick={() => { setMode('import'); setError(''); setNotice(''); }} style={btn(mode === 'import')}>
          Import
        </button>
      </div>

      {mode === 'export' ? (
        <form onSubmit={handleExport} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
            Saves all your personas (including their private signing keys) and your subscribed topics
            into one encrypted file. Choose a password — you&apos;ll need it to restore.
          </div>
          <input type="password" placeholder="Backup password (min 8 chars)" value={pw} onChange={(e) => setPw(e.target.value)} style={field} autoComplete="new-password" />
          <input type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={field} autoComplete="new-password" />
          <button type="submit" disabled={busy} style={btn(true)}>
            {busy ? 'Encrypting…' : 'Download encrypted backup'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
            Restores personas and topics from a backup file. They are <b>added</b> to this browser —
            nothing already here is removed.
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} style={{ ...field, padding: '0.45rem' }} />
          {fileName && <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Selected: {fileName}</div>}
          <input type="password" placeholder="Backup password" value={importPw} onChange={(e) => setImportPw(e.target.value)} style={field} autoComplete="off" />
          <button type="submit" disabled={busy} style={btn(true)}>
            {busy ? 'Restoring…' : 'Restore from backup'}
          </button>
        </form>
      )}

      {error && <div style={{ color: '#ff6b6b', fontSize: '0.78rem', marginTop: '0.6rem' }}>{error}</div>}
      {notice && <div style={{ color: 'var(--color-success)', fontSize: '0.78rem', marginTop: '0.6rem' }}>{notice}</div>}
    </div>
  );
};

export default IdentityBackupPanel;
