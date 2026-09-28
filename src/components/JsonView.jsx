import React, { useState } from 'react';

// STRUCTURED JSON, RENDERED AS TEXT AND NEVER AS MARKUP.
//
// #axona-track is OPEN WRITE: anything on the network can publish to it, and a
// client that renders an arbitrary payload as markup is an injection surface
// fed by an unauthenticated topic. Every value below reaches the DOM as a React
// child, which React escapes — this file uses no raw-HTML escape hatch and must
// never acquire one. A "safe" HTML pass would be a sanitiser to maintain
// forever; text has no such failure mode.
//
// (The fence for that rule greps this file for the escape-hatch prop by NAME,
// so the name must not appear here even in prose. A test that cannot be
// satisfied by a comment is a test that cannot be talked out of.)
//
// Three budgets, because a payload is untrusted in SIZE as well as in content
// (Aster, council seq 437 — "depth/size limits"; axona.bot seq 440):
//   MAX_DEPTH   a deeply nested object stops rather than recursing forever
//   MAX_NODES   a wide object stops rather than laying out tens of thousands
//               of rows and freezing the message list
//   MAX_STRING  one enormous string is clipped rather than reflowing the panel
// Hitting a budget DEGRADES — it shows what was reached and says so. It never
// throws, never renders nothing, and never silently truncates without a marker,
// because a reader who cannot tell "empty" from "clipped" has been misinformed
// rather than protected.

const MAX_DEPTH  = 6;
const MAX_NODES  = 300;
const MAX_STRING = 500;

const COLORS = {
  key:    'var(--color-primary-light, #7fb3ff)',
  string: '#98c379',
  number: '#d19a66',
  bool:   '#c678dd',
  null:   'var(--color-muted)',
  punct:  'var(--color-muted)',
};

const Primitive = ({ value }) => {
  if (value === null)      return <span style={{ color: COLORS.null }}>null</span>;
  if (typeof value === 'boolean') return <span style={{ color: COLORS.bool }}>{String(value)}</span>;
  if (typeof value === 'number')  return <span style={{ color: COLORS.number }}>{String(value)}</span>;
  const s = String(value);
  const clipped = s.length > MAX_STRING;
  return (
    <span style={{ color: COLORS.string, wordBreak: 'break-word' }}>
      "{clipped ? s.slice(0, MAX_STRING) : s}"
      {clipped && (
        <span style={{ color: COLORS.punct, fontStyle: 'italic' }}>
          {' '}… {s.length - MAX_STRING} more characters
        </span>
      )}
    </span>
  );
};

// A counter object threaded through the walk. Passed by reference so siblings
// share one budget — a per-branch budget would let a wide object multiply it.
const Node = ({ name, value, depth, budget, defaultOpen }) => {
  const isObject = value !== null && typeof value === 'object';
  const [open, setOpen] = useState(!!defaultOpen);

  if (budget.n >= MAX_NODES) return null;
  budget.n += 1;

  const label = name !== undefined && (
    <span style={{ color: COLORS.key }}>{name}: </span>
  );

  if (!isObject) {
    return (
      <div style={{ paddingLeft: depth ? '1rem' : 0 }}>
        {label}<Primitive value={value} />
      </div>
    );
  }

  if (depth >= MAX_DEPTH) {
    return (
      <div style={{ paddingLeft: '1rem', color: COLORS.punct, fontStyle: 'italic' }}>
        {label}… nested deeper than {MAX_DEPTH} levels, not shown
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const bracket = Array.isArray(value) ? ['[', ']'] : ['{', '}'];

  return (
    <div style={{ paddingLeft: depth ? '1rem' : 0 }}>
      {/* A real button, so the tree is operable from the keyboard and announces
          its state. A div with onClick is invisible to anyone not using a
          mouse (Aster, seq 442, on the same mistake in ChannelList). */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          background: 'transparent', border: 'none', padding: 0, margin: 0,
          font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: COLORS.punct }}>{open ? '▾' : '▸'} </span>
        {label}
        <span style={{ color: COLORS.punct }}>
          {bracket[0]}{open ? '' : `… ${entries.length}`}{open ? '' : bracket[1]}
        </span>
      </button>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} budget={budget} />
          ))}
          <div style={{ color: COLORS.punct }}>{bracket[1]}</div>
        </>
      )}
    </div>
  );
};

const JsonView = ({ value, title }) => {
  const budget = { n: 0 };
  let body;
  try {
    body = <Node value={value} depth={0} budget={budget} defaultOpen />;
  } catch {
    // Cyclic or otherwise hostile input must not take the message list with it.
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
        This payload could not be displayed as structured data.
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.72rem',
        lineHeight: 1.5,
        background: 'rgba(0,0,0,0.18)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '0.5rem 0.6rem',
        overflowX: 'auto',
      }}
    >
      {title && (
        <div style={{ color: 'var(--color-muted)', marginBottom: '0.35rem', fontSize: '0.65rem', letterSpacing: '0.3px' }}>
          {title}
        </div>
      )}
      {body}
      {budget.n >= MAX_NODES && (
        <div style={{ color: COLORS.punct, fontStyle: 'italic', marginTop: '0.35rem' }}>
          … stopped after {MAX_NODES} fields. The payload is larger than this view shows.
        </div>
      )}
    </div>
  );
};

export default JsonView;
