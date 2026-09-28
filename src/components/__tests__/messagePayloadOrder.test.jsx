// SUMMARY ABOVE DETAIL, ASSERTED IN THE RENDERED DOM.
//
// David, council seq 490: the note saying what happened in human terms belongs
// at the TOP of the payload. axona.chat shipped it the other way round — the
// JSON tree rendered above the prose, so a reader met a hundred rows of fields
// before the one line explaining them.
//
// A source-order check catches the JSX swap, and there is one in
// jsonView.test.js. It does not catch the ways the ORDER can change without the
// JSX moving: a flex container with `column-reverse`, a wrapper that hoists one
// child, a conditional that renders the tree in a second place. This file
// mounts the real component and asks the DOM which node comes first.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

import Message from '../Message.jsx';
import { useChatStore } from '../../stores/useChatStore.js';

// jsdom ships no ResizeObserver, and the long-message panel measures itself
// with one. A no-op is right here: this test asserts order, not layout.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

// The shape an instrument publisher sends: a human-readable `text` beside a
// structured `data` object. Both must render, and `text` must come first.
const envelope = {
  msgId: 'order-1',
  signerPubkey: 'a'.repeat(64),
  ts: Date.now(),
  message: {
    v: 1,
    handle: 'axona.track',
    authorClass: 'instrument',
    text: 'State Transition: Frozen to Hidden',
    data: {
      event: 'state_transition',
      from: 'frozen',
      to: 'hidden',
      appVersion: '0.1.1',
      kernelVersion: '4.99.0',
    },
  },
};

const mount = () =>
  render(<Message envelope={envelope} activeTopic={{ region: 'eagle', name: 'lobby' }} />);

describe('an instrument payload renders its summary before its detail', () => {
  beforeEach(() => {
    cleanup();
    useChatStore.setState({ currentHandle: null, authorClasses: {} });
  });

  it('renders BOTH the note and the tree — neither replaces the other', () => {
    const { container } = mount();
    expect(container.textContent).toContain('State Transition: Frozen to Hidden');
    expect(container.querySelector('.json-view')).toBeTruthy();
    expect(container.textContent).toContain('state_transition');
  });

  it('the note comes FIRST in the document', () => {
    const { container } = mount();
    const tree = container.querySelector('.json-view');
    expect(tree).toBeTruthy();

    // The element that actually carries the note text, not an ancestor that
    // also contains the tree — an ancestor would compare as "contains" rather
    // than "precedes" and the assertion would say nothing.
    const noteEl = [...container.querySelectorAll('*')].find(
      el => el.textContent.includes('State Transition: Frozen to Hidden') && !el.contains(tree)
    );
    expect(noteEl).toBeTruthy();

    const rel = noteEl.compareDocumentPosition(tree);
    expect(rel & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rel & Node.DOCUMENT_POSITION_PRECEDING).toBeFalsy();
  });
});
