// ENTER SENDS — BUT NEVER WHILE AN IME IS COMPOSING.
//
// David asked for Enter to send and Shift+Enter to newline (council seq 433).
// Aster flagged the trap before it shipped (seq 437): while an input method
// editor is composing — Japanese, Chinese, Korean and others — Enter COMMITS
// THE CANDIDATE. It does not mean "send". A handler that treats every Enter as
// an action fires mid-word and dispatches a half-typed sentence, and it does so
// ONLY for people composing in those scripts: invisible to whoever wrote the
// handler, constant for everyone affected.
//
// ORDER IS THE WHOLE FENCE. The guard must run BEFORE the Enter branch, or the
// branch wins and the guard is decoration. These assertions read the source and
// compare positions, because a unit test that calls the handler with a
// synthetic event proves the branch works and says nothing about which line
// comes first.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/Composer.jsx', 'utf8');

describe('composer Enter-to-send', () => {
  it('a composition guard exists and reads both signals', () => {
    // isComposing is the standard; keyCode 229 is the legacy IME marker still
    // emitted by some IMEs and older WebKit. Neither alone is universal.
    expect(/isComposingEvent/.test(src)).toBe(true);
    expect(/isComposing/.test(src)).toBe(true);
    expect(/keyCode === 229/.test(src)).toBe(true);
  });

  it('THE GUARD RUNS BEFORE THE ENTER BRANCH', () => {
    const guard = src.indexOf('if (isComposingEvent(e)) return;');
    const enter = src.indexOf("if (e.key === 'Enter'");
    expect(guard).toBeGreaterThan(-1);
    expect(enter).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(enter);
  });

  it('Shift+Enter is excluded from send, so it can make a newline', () => {
    expect(/e\.key === 'Enter' && !e\.shiftKey/.test(src)).toBe(true);
  });

  it('the tip text tells the user the new binding', () => {
    expect(/<b>Enter<\/b> sends/.test(src)).toBe(true);
    expect(/<b>Shift \+ Enter<\/b> new line/.test(src)).toBe(true);
  });
});

describe('composer Delete discards a DRAFT, reversibly', () => {
  it('Delete calls the discard handler, not a send or a message delete', () => {
    expect(/onClick=\{handleDiscardDraft\}/.test(src)).toBe(true);
  });

  it('the discarded text is stashed so Undo can restore it', () => {
    expect(/setDiscarded\(current\)/.test(src)).toBe(true);
    expect(/handleUndoDiscard/.test(src)).toBe(true);
  });

  it('Undo re-seeds the editor from the stash', () => {
    expect(/setContent\(discarded/.test(src)).toBe(true);
  });

  it('the undo timer is cleared on unmount', () => {
    expect(/clearTimeout\(undoTimer\.current\)/.test(src)).toBe(true);
  });

  // The label must not imply it removes a SENT message. Aster, seq 437.
  it('the control is titled as discarding a draft', () => {
    expect(/Discard this draft and close the editor/.test(src)).toBe(true);
  });
});
