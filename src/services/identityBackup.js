// Whole-profile backup: export every persona (name + author key envelope),
// the active-handle selection, the operator declaration, and the subscribed
// topics into ONE password-encrypted file, and restore it on another browser.
//
// Why a single encrypted JSON, not an encrypted zip: the payload is a small
// key-bearing blob, not a file tree. AES-GCM via WebCrypto is authenticated
// (a wrong password or a tampered file fails to decrypt rather than yielding
// garbage), native (no dependency), and stronger than legacy zip crypto. The
// file contains PRIVATE SIGNING KEYS and any private-channel keys, so a
// password is mandatory — there is no plaintext export path.
//
// Everything the app persists lives under the `axona-` localStorage prefix
// (author keys as `axona-author-<id>`, handles, topics, watermarks, …), so we
// snapshot that namespace wholesale. Three of those keys are ALSO mirrored in
// IndexedDB by HandleContext, and its loader reads IndexedDB first — so a
// restore that only wrote localStorage would be invisible after reload. We
// mirror those three back into IndexedDB explicitly.

import { get as idbGet, set as idbSet } from 'idb-keyval';
import { getTopicId } from '../stores/useChatStore.js';

const FORMAT = 'axona-identity-backup';
const PREFIX = 'axona-';
// Keys HandleContext persists to IndexedDB (and reads from there first).
const IDB_MIRRORED = ['axona-handles', 'axona-active-handle-id', 'axona-global-declaration'];

// --- base64 <-> bytes -------------------------------------------------------
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const safeParse = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

// --- profile snapshot -------------------------------------------------------

// Read an IndexedDB-mirrored value as the string localStorage would hold.
// HandleContext stores handles as an array and the scalars as strings in idb.
const idbAsString = async (key) => {
  try {
    const v = await idbGet(key);
    if (v == null) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch { return null; }
};

// Snapshot every `axona-` localStorage entry — author keys, handles, active
// selection, topics, watermarks, location, theme, onboarding. The three keys
// HandleContext mirrors to IndexedDB (handles, active selection, declaration)
// can be present ONLY in IndexedDB — its persist effect doesn't always re-write
// localStorage — so we backfill those from IndexedDB when localStorage lacks
// them. Without this, a backup could silently omit the operator declaration.
export const collectProfile = async () => {
  const keys = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys[k] = localStorage.getItem(k);
  }
  for (const k of IDB_MIRRORED) {
    if (keys[k] == null) {
      const fromIdb = await idbAsString(k);
      if (fromIdb != null) keys[k] = fromIdb;
    }
  }
  const personaCount = safeParse(keys['axona-handles'], []).length;
  return { app: 'axona-chat', personaCount, keys };
};

// --- crypto -----------------------------------------------------------------

const PBKDF2_ITER = 250_000;

const deriveKey = async (password, salt, iterations) => {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt a profile snapshot under `password`. Returns pretty JSON text ready
// to write to a .json file.
export const encryptBackup = async (password, profile) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITER);
  const plaintext = new TextEncoder().encode(JSON.stringify(profile));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return JSON.stringify({
    format: FORMAT,
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITER, salt: toB64(salt) },
    cipher: 'AES-GCM',
    iv: toB64(iv),
    ct: toB64(ct)
  }, null, 2);
};

// Decrypt backup file text under `password`. Throws a friendly error on a
// wrong password, tampered file, or wrong file type.
export const decryptBackup = async (password, fileText) => {
  const env = safeParse(fileText, null);
  if (!env || env.format !== FORMAT) {
    throw new Error('This is not an Axona identity backup file.');
  }
  const key = await deriveKey(password, fromB64(env.kdf.salt), env.kdf.iterations);
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(env.iv) }, key, fromB64(env.ct)
    );
  } catch {
    throw new Error('Wrong password, or the backup file is corrupted.');
  }
  return safeParse(new TextDecoder().decode(plaintext), null);
};

// --- restore ----------------------------------------------------------------

// Merge a decrypted profile into this browser's storage. Additive by design:
// existing personas and topics are kept; new ones are added. Personas dedupe
// by authorId (the machine identity), topics by kernel topic id. Nothing is
// destroyed, so importing onto a browser that already has an identity is safe.
export const importProfile = async (profile) => {
  const incoming = profile?.keys || {};

  // Personas: union by authorId.
  const current = safeParse(localStorage.getItem('axona-handles'), []);
  const byAuthor = new Map(current.map((h) => [h.authorId, h]));
  let added = 0;
  for (const h of safeParse(incoming['axona-handles'], [])) {
    if (h && h.authorId && !byAuthor.has(h.authorId)) {
      byAuthor.set(h.authorId, h);
      added += 1;
    }
  }
  const mergedHandles = [...byAuthor.values()];

  // Author key envelopes (`axona-author-<handleId>`): copy any we don't have.
  // A persona's authorRef points at its own key entry; keeping the existing
  // handle on an authorId collision keeps the existing (identical) key.
  for (const k of Object.keys(incoming)) {
    if (k.startsWith('axona-author-') && localStorage.getItem(k) == null) {
      localStorage.setItem(k, incoming[k]);
    }
  }
  localStorage.setItem('axona-handles', JSON.stringify(mergedHandles));

  // Topics: union by kernel topic id (private-channel keys ride along).
  const curTopics = safeParse(localStorage.getItem('axona-topics'), []);
  const topicById = new Map(curTopics.map((t) => [getTopicId(t), t]));
  for (const t of safeParse(incoming['axona-topics'], [])) {
    if (t && !topicById.has(getTopicId(t))) topicById.set(getTopicId(t), t);
  }
  localStorage.setItem('axona-topics', JSON.stringify([...topicById.values()]));

  // Unread watermarks: keep the newer mark per topic.
  const curRead = safeParse(localStorage.getItem('axona-last-read'), {});
  const mergedRead = { ...curRead };
  for (const [id, mark] of Object.entries(safeParse(incoming['axona-last-read'], {}))) {
    mergedRead[id] = Math.max(mergedRead[id] || 0, mark || 0);
  }
  localStorage.setItem('axona-last-read', JSON.stringify(mergedRead));

  // Scalars: only adopt an imported value where this browser has none, so an
  // import never yanks the active persona out from under you.
  for (const k of ['axona-active-handle-id', 'axona-node-location']) {
    if (localStorage.getItem(k) == null && incoming[k] != null) localStorage.setItem(k, incoming[k]);
  }
  // The operator declaration (human/agent) is safety-relevant (§6.3) and can
  // live only in IndexedDB, so guard against BOTH stores: adopt the backup's
  // value only when this browser has no declaration anywhere. This is what
  // stops an import from silently flipping an existing user's declared class.
  if (incoming['axona-global-declaration'] != null) {
    const existingDecl = localStorage.getItem('axona-global-declaration') ?? (await idbAsString('axona-global-declaration'));
    if (existingDecl == null) localStorage.setItem('axona-global-declaration', incoming['axona-global-declaration']);
  }
  // The imported profile came from a set-up app; treat this browser as set up
  // so restore doesn't drop the user back onto the onboarding gate.
  localStorage.setItem('axona-onboarded', '1');

  // Mirror the IndexedDB-backed keys (HandleContext reads IndexedDB first).
  try {
    await idbSet('axona-handles', mergedHandles);
    const activeId = localStorage.getItem('axona-active-handle-id');
    if (activeId) await idbSet('axona-active-handle-id', activeId);
    const decl = localStorage.getItem('axona-global-declaration');
    if (decl) await idbSet('axona-global-declaration', decl);
  } catch {
    // IndexedDB unavailable (private mode): localStorage-only load path covers it.
  }

  return { personasAdded: added, personasTotal: mergedHandles.length };
};
