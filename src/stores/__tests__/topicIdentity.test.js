// A DISPLAY NAME IS NOT AN IDENTITY.
//
// Why this fence exists (Aster, council seq 442). getTopicId is
// `region:owner:name:write` — owner and write FOLD INTO the topic id, so two
// channels can share a name and a region and still be entirely different
// topics. ChannelList computed `isActive` from name+region alone. Two such
// channels therefore BOTH rendered as active, and because the unread count was
// written `isActive ? 0 : countUnread(...)`, the non-selected one had its badge
// suppressed — its messages arrived silently.
//
// The same error, in a different costume, sent five council posts to
// "axona/council" while the channel was "council": each returned ok:true to an
// audience of nobody. Comparing on part of an identity is not comparing on the
// identity.
//
// These assertions are about DESCRIPTOR IDENTITY, not about React. They fail if
// anyone narrows getTopicId or reintroduces a partial comparison.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

import { getTopicId } from '../useChatStore.js';

// The comparison ChannelList used to make. Kept here deliberately so the
// difference between the two is asserted rather than described.
const namePlusRegionMatch = (a, b) =>
  !!a && !!b && a.name === b.name && a.region === b.region;

describe('topic identity — owner and write fold into the id', () => {
  const open = { region: 'eagle', name: 'council' };
  const owned = { region: 'eagle', name: 'council', write: 'owner', owner: 'abc123' };
  const otherOwner = { region: 'eagle', name: 'council', write: 'owner', owner: 'def456' };

  it('an open topic and an owner-write topic of the same name are DIFFERENT topics', () => {
    expect(getTopicId(open)).not.toBe(getTopicId(owned));
  });

  it('two owner-write topics differing only in owner are DIFFERENT topics', () => {
    expect(getTopicId(owned)).not.toBe(getTopicId(otherOwner));
  });

  it('the same descriptor yields a stable id', () => {
    expect(getTopicId(owned)).toBe(getTopicId({ ...owned }));
  });

  it('a different region is a different topic', () => {
    expect(getTopicId(open)).not.toBe(getTopicId({ ...open, region: 'us-east' }));
  });

  // The discriminating pair. The old comparison COLLIDES on every case above;
  // the id comparison separates them. If these two ever agree, the bug is back.
  it('THE OLD name+region COMPARISON COLLIDES where the id does not', () => {
    expect(namePlusRegionMatch(open, owned)).toBe(true);        // wrong, and shipped
    expect(getTopicId(open) === getTopicId(owned)).toBe(false); // right
  });

  it('…and collides between two distinct owners too', () => {
    expect(namePlusRegionMatch(owned, otherOwner)).toBe(true);
    expect(getTopicId(owned) === getTopicId(otherOwner)).toBe(false);
  });

  // Defaults must be explicit: an absent write is 'open' and an absent owner is
  // empty, so a descriptor written either way denotes the same topic. If these
  // drift apart, a channel silently forks in two.
  it('an absent write defaults to open, so both spellings agree', () => {
    expect(getTopicId({ region: 'eagle', name: 'jokes' }))
      .toBe(getTopicId({ region: 'eagle', name: 'jokes', write: 'open', owner: '' }));
  });
});

// The block above pins the SEMANTICS. It does not pin the CALLER — every
// assertion there passes with ChannelList still comparing name+region, which is
// exactly the hole Aster found in my bridge fence (council seq 432): a semantic
// pair that survives deleting the fix is not a fence. So assert the call site in
// the source too.
describe('ChannelList selects on the full topic id, in the source', () => {
  const src = readFileSync(
    new URL('../../components/ChannelList.jsx', import.meta.url), 'utf8');

  it('isActive is computed from getTopicId, not from name/region parts', () => {
    expect(/const isActive\s*=[^\n]*getTopicId\(activeTopic\)/.test(src)).toBe(true);
  });

  it('the discarded name+region comparison is GONE', () => {
    expect(/activeTopic\.name\s*===\s*topic\.name/.test(src)).toBe(false);
  });

  it('the row key is the topic id, not a list index', () => {
    expect(/key=\{topicId\}/.test(src)).toBe(true);
    expect(/key=\{`\$\{topic\.name\}-\$\{idx\}`\}/.test(src)).toBe(false);
  });

  it('topic selection is a real button with a selected state, not an onClick div', () => {
    expect(/aria-current=\{isActive/.test(src)).toBe(true);
  });
});
