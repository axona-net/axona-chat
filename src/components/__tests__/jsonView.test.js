// AN UNTRUSTED PAYLOAD RENDERS AS TEXT, WITH BUDGETS.
//
// #axona-track is OPEN WRITE — anything on the network can publish to it. A
// client that renders an arbitrary payload as markup is an injection surface fed
// by an unauthenticated topic (Aster, council seq 437; axona.bot seq 440). The
// payload is also untrusted in SIZE: depth, breadth and string length all need
// a ceiling, or one message can freeze the list it arrives in.
//
// These are source assertions. A render test would prove the component works on
// the input it was given; what has to hold is that the DANGEROUS CONSTRUCT IS
// ABSENT from the file entirely, which only reading the source can establish.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/components/JsonView.jsx', 'utf8');
const msg  = readFileSync('src/components/Message.jsx', 'utf8');

describe('JsonView renders untrusted data safely', () => {
  it('NEVER sets inner HTML', () => {
    expect(/dangerouslySetInnerHTML/.test(view)).toBe(false);
  });

  it('carries all three budgets', () => {
    expect(/MAX_DEPTH\s*=\s*\d+/.test(view)).toBe(true);
    expect(/MAX_NODES\s*=\s*\d+/.test(view)).toBe(true);
    expect(/MAX_STRING\s*=\s*\d+/.test(view)).toBe(true);
  });

  it('the node budget is SHARED across siblings, not per branch', () => {
    // A per-branch budget lets a wide object multiply the ceiling.
    expect(/budget\.n \+= 1/.test(view)).toBe(true);
    expect(/budget\.n >= MAX_NODES/.test(view)).toBe(true);
  });

  it('stops at depth instead of recursing without bound', () => {
    expect(/depth >= MAX_DEPTH/.test(view)).toBe(true);
  });

  it('truncation is VISIBLE — a reader can tell clipped from empty', () => {
    expect(/more characters/.test(view)).toBe(true);
    expect(/stopped after \{MAX_NODES\} fields/.test(view)).toBe(true);
    expect(/not shown/.test(view)).toBe(true);
  });

  it('collapse is a real button with an expanded state, not an onClick div', () => {
    expect(/aria-expanded=\{open\}/.test(view)).toBe(true);
  });

  it('hostile input degrades instead of taking the list down', () => {
    expect(/could not be displayed as structured data/.test(view)).toBe(true);
  });
});

describe('Message decides when a payload is structured', () => {
  it('parsing is guarded — a body that only looks like JSON must not throw', () => {
    expect(/try \{\s*const parsed = JSON\.parse\(s\);/.test(msg)).toBe(true);
  });

  it('an unbounded body is not parsed at all', () => {
    expect(/64 \* 1024/.test(msg)).toBe(true);
  });

  it('only objects and arrays become a tree, never a bare primitive', () => {
    expect(/typeof parsed === 'object' \? parsed : null/.test(msg)).toBe(true);
  });

  // The markdown path must survive: an instrument sends a readable `text`
  // alongside `data`, and showing only one of them loses half the message.
  it('the markdown render still runs beside the tree', () => {
    expect(/\{structuredPayload && \(/.test(msg)).toBe(true);
    expect(/<ReactMarkdown/.test(msg)).toBe(true);
  });

  // react-markdown escapes raw HTML unless rehype-raw is added. If that ever
  // changes, every message body becomes an injection surface, not just JSON.
  it('raw-HTML markdown is NOT enabled', () => {
    expect(/rehypeRaw|rehype-raw/.test(msg)).toBe(false);
  });
});
