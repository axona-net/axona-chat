// THE BADGE IS THE ATTESTATION, NEVER THE CLAIM.
//
// axona.chat badges an author class from the kernel's SIGNED attestation
// (peer.getAuthorClass, keyed by the authenticated signer) and never from the
// in-body `authorClass` string, which any publisher can type. A badge that
// could be self-asserted would certify nothing — its entire value is that it is
// not the claim being made.
//
// David settled the vocabulary at council seq 449: the field names the NATURE
// OF THE SOURCE of the data — human, agent, instrument. 'stream' describes the
// data itself and was therefore the wrong word for this field.
//
// These are source assertions rather than render tests, for the same reason the
// bridge fence needed them (Aster, seq 432): a semantic table can be correct
// while the component ignores it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Paths from the project root, not from import.meta.url: the component tests
// run under jsdom, where import.meta.url is an http: URL and readFileSync
// rejects it with ERR_INVALID_URL_SCHEME.
const msg = readFileSync('src/components/Message.jsx', 'utf8');
const client = readFileSync('src/services/AxonaChatClient.js', 'utf8');

describe('author-class badges', () => {
  it('recognises all three classes David settled on', () => {
    for (const cls of ['human', 'agent', 'instrument']) {
      expect(new RegExp(`\\b${cls}:\\s*\\{`).test(msg)).toBe(true);
    }
  });

  it('does NOT badge "stream" — it describes the data, not the source', () => {
    expect(/\bstream:\s*\{/.test(msg)).toBe(false);
  });

  it('the badge is driven by the table, not a hardcoded human/agent pair', () => {
    expect(/const badgeClass = BADGES\[resolvedClass\]/.test(msg)).toBe(true);
    // The two-way ternary this replaced silently dropped any third class.
    expect(/resolvedClass === 'human' \|\| resolvedClass === 'agent'/.test(msg)).toBe(false);
  });

  it('an unrecognised class degrades to NO BADGE, never to hidden', () => {
    // badgeClass falls to null, and the badge is rendered behind `badgeClass &&`.
    expect(/\? resolvedClass : null/.test(msg)).toBe(true);
    expect(/\{badgeClass && \(/.test(msg)).toBe(true);
  });

  it('the badge reads the RESOLVED attestation, not payload.authorClass', () => {
    expect(/authorClasses\[signerPubkey\]/.test(msg)).toBe(true);
    // badgeClass — the SOLID badge — is derived from the resolved attestation
    // and from nothing else. The body string may now be READ (for the dashed
    // self-declared chip), so a blanket "payload.authorClass never appears"
    // check no longer says what matters. This one does: the badge's own
    // derivation must not touch it.
    expect(/const badgeClass = BADGES\[resolvedClass\] \? resolvedClass : null;/.test(msg)).toBe(true);
    expect(/badgeClass\s*=\s*[^\n]*payload\.authorClass/.test(msg)).toBe(false);
  });

  it('a SELF-DECLARED class is shown separately and never as the solid badge', () => {
    // Rendered only when there is no attested class, visually distinct
    // (dashed outline, not a fill), and labelled as a claim on the chip itself.
    expect(/!badgeClass && selfDeclaredClass/.test(msg)).toBe(true);
    expect(/self-declared/.test(msg)).toBe(true);
    expect(/border: '1px dashed/.test(msg)).toBe(true);
  });

  it('a RAW publish still shows what it calls itself, from inside the JSON', () => {
    expect(/isRawPublish \? structuredPayload\?\.authorClass : payload\.authorClass/.test(msg)).toBe(true);
  });

  // KNOWN GAP, asserted so it cannot be forgotten. The client can recognise a
  // verified 'instrument', but nothing can yet ATTEST one: declareAuthorClass
  // only ever calls setAuthorClass for 'human' or 'agent'. Until the attestation
  // side supports it, an instrument publisher renders correctly but UNBADGED.
  // When that changes, this assertion fails and is the prompt to revisit.
  it('DEPENDENCY: the declarable set is still human/agent only', () => {
    expect(/cls !== 'human' && cls !== 'agent'/.test(client)).toBe(true);
  });
});
