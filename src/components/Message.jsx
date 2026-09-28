import React, { useState, useRef, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import JsonView from './JsonView.jsx';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useChatStore } from '../stores/useChatStore.js';
import AxonaChatClient from '../services/AxonaChatClient.js';
import LinkPreview from './LinkPreview.jsx';
import TopicLinkChip from './TopicLinkChip.jsx';
import { isTopicLink, isAxonaName } from '../services/topicLink.js';
import { extractUrls, isImageUrl, isYouTubeUrl, isAxonaNameUrl } from '../services/messageUrls.js';

// Long-message panel height: comfortably smaller than the viewport so a
// single message can never dominate the list.
// COMPUTED ON USE, NEVER ONCE AT MODULE LOAD.
//
// This was `const PANEL_H = Math.min(360, Math.round(window.innerHeight * 0.45))`
// evaluated at import. `window.innerHeight` is 0 when a module is imported into
// a view that has not been laid out yet — a background tab, a hidden pane, a
// freshly created window. PANEL_H then froze at 0 FOR THE LIFE OF THE PAGE, and
// since a long message renders inside `maxHeight: ${PANEL_H}px`, every long
// message collapsed to a ZERO-HEIGHT PANEL. The message tile still drew its
// header and its Copy/Reply row, so it looked like a message with no body
// rather than like a bug: content SILENTLY UNREACHABLE, with no error anywhere.
//
// Found 2026-09-28 in the browser pane, whose tab is created before layout.
// The floor keeps the panel usable even if innerHeight is briefly small, and
// the fallback covers innerHeight being 0 or undefined outright.
const panelH    = () => Math.max(180, Math.min(360, Math.round((window.innerHeight || 800) * 0.45)));
// A message only a little over the panel height isn't worth capping.
const PANEL_TOL = 60;
// How far the arrow buttons advance per press — most of a panel, with overlap
// so no line is ever skipped across a step.
const arrowStep = () => Math.round(panelH() * 0.8);
// A FINGER never arms the panel (Aster, CHANGES-REQUIRED b0c204e and 8d37e65).
// A tap has no mouse-leave to disarm it, so arming on touch re-creates the
// #405 scroll trap permanently — swipes over the tile would scroll the inner
// panel forever and never the list. Touch input has the arrows instead:
// programmatic scrollBy works under overflow:hidden, so stepping never needs
// the panel armed at all.
//
// This is decided PER EVENT from the pointer that produced it, not once at
// module load from '(hover: none)'. A hybrid device — iPad with a keyboard
// case, a Surface, a touchscreen laptop — reports hover:hover because a mouse
// exists, while a finger tap on that same machine still reaches the click
// handler. Classifying the DEVICE traps exactly those users; classifying the
// POINTER cannot, because the finger and the mouse are then distinguished at
// the moment either one is used.
const isMousePointer = (type) => type === 'mouse';

// Whether a cursor can hover here at all. Used ONLY for the hint text and the
// pointer cursor — presentation. Never for arming.
const canHover = typeof window !== 'undefined'
  && !!window.matchMedia?.('(hover: hover)').matches;

// The author classes this client will BADGE, keyed by the value the kernel's
// signed attestation returns. A class absent from this table is rendered
// unbadged and never hidden — the kernel's rule is that absence means UNSTATED,
// never a default, and an unrecognised future class must degrade to "no badge"
// rather than to "Anonymous" or to nothing at all (Aster, council seq 437).
// WHAT THE BADGE ACTUALLY MEANS, because the wording matters and my first
// attempt got it wrong (Aster, council seq 458). A signed class attestation
// authenticates WHICH AUTHOR MADE THE SELF-DECLARATION. It does NOT certify
// that the declared nature is true, and nothing here independently checks it.
// Binding the claim to an authenticated signer is worth a great deal — it is
// the difference between a claim anyone can type and one only the key-holder
// can make — but it is not certification, and the hint text must not say
// "verified" as though some third party had confirmed the fact.
const BADGES = {
  human:      { label: 'HUMAN',      bg: 'rgba(52, 152, 219, 0.15)', fg: '#3498db',
                hint: 'This author declared itself a person, signed with its own key. The signature shows who made the declaration — not that it is true.' },
  agent:      { label: 'AGENT',      bg: 'rgba(155, 89, 182, 0.15)', fg: '#9b59b6',
                hint: 'This author declared itself an autonomous agent, signed with its own key. The signature shows who made the declaration — not that it is true.' },
  instrument: { label: 'INSTRUMENT', bg: 'rgba(26, 188, 156, 0.15)', fg: '#1abc9c',
                hint: 'This author declared itself an automatic data source, signed with its own key. It reports readings rather than making claims, so read it with its calibration and failure modes in mind. The signature shows who declared it — not that the readings are right.' },
};

const Message = ({ envelope, activeTopic, onReply, onPrivateReply, level = 0 }) => {
  const { msgId, signerPubkey, ts } = envelope;
  const payload = envelope.message;
  const { currentHandle } = useChatStore();
  // VERIFIED author-class from the kernel's signed attestation (getAuthorClass),
  // keyed by the authenticated signerPubkey — NOT the spoofable in-body string.
  const resolvedClass = useChatStore(s => s.authorClasses[signerPubkey]?.class);
  // Honest send state: a publish is pending until its envelope echoes back
  // while the session has peers. An echo on a zero-peer island proves nothing
  // — the local node roots the topic itself and delivers to itself. Rendering
  // such a message as plainly "sent" cost a real question its answer
  // (2026-08-05): it sat on a slept session's island for hours, delivered to
  // no one, looking exactly like every message that made it.
  const pendingSend = useChatStore(s => s.pendingSends[msgId]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Long-message handling: content taller than PANEL_H renders inside a
  // fixed-height panel that scrolls — but ONLY once the reader clicks it.
  //
  // This replaces the Previous/Next paging (v0.45), whose page offsets were
  // measured once and then falsified by late-loading embeds: pages overlapped,
  // spilled past the panel edge, or left a near-empty last page. A plain inner
  // scrollbar was rejected back then for a real reason — it traps the wheel,
  // so scrolling the LIST stalls whenever the pointer crosses a long message
  // (issue #405). The click-to-arm scheme keeps both behaviours: while the
  // panel is unarmed its overflow is hidden, wheel events find nothing to
  // scroll and fall through to the list; a click arms it (overflow:auto with
  // overscroll-behavior:contain, so hitting its end doesn't yank the list);
  // the pointer leaving the tile disarms it again. Wherever the pointer is,
  // the thing under it scrolls the way the reader expects.
  //
  // Affordances: fade gradients show clipped content above/below, and an
  // arrow button appears at each edge only while that direction can actually
  // scroll. The arrows work without arming first — pressing one arms the
  // panel and steps it by ARROW_STEP.
  const contentRef = useRef(null);
  const panelRef = useRef(null);
  const [isLong, setIsLong] = useState(false);
  const [armed, setArmed] = useState(false);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const updateEdges = () => {
    const panel = panelRef.current;
    if (!panel) return;
    // 4px slack: fractional scroll positions on zoomed displays never quite
    // reach the exact limit, and an arrow that won't disappear reads as broken.
    setCanUp(panel.scrollTop > 4);
    setCanDown(panel.scrollTop + panel.clientHeight < panel.scrollHeight - 4);
  };

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => {
      setIsLong(content.scrollHeight > panelH() + PANEL_TOL);
      updateEdges();
    };
    measure();
    const ro = new ResizeObserver(measure);   // re-measure as embeds load
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  // The measure above runs BEFORE the render that applies the maxHeight clamp,
  // so its edge check sees an unclamped panel (clientHeight === scrollHeight)
  // and reads "nothing below". Re-check once the clamp is actually in effect.
  useLayoutEffect(() => { updateEdges(); }, [isLong, armed]);

  // What kind of pointer produced the click currently being handled. React's
  // synthetic click carries no pointerType, so it is recorded on the pointerdown
  // that precedes it. A click with no preceding pointerdown (keyboard, or a
  // synthetic dispatch) leaves this null and does not arm — arming is a
  // mouse-only affordance, and every other input has the arrows.
  const lastPointerType = useRef(null);
  const notePointer = (e) => { lastPointerType.current = e.pointerType || null; };

  // Arm on click — but not when the click was really something else: a link
  // or button doing its own job, or the mouseup end of a text selection.
  const handlePanelClick = (e) => {
    // CONSUME the recorded pointer. It belongs to exactly one click. Left in
    // place it survives as 'mouse' after any real mouse click, so the next
    // click WITHOUT a pointerdown — keyboard activation, a synthetic dispatch —
    // inherits it and arms. That is the same "a device said it was safe" error
    // one level down, and this file's own comment claimed otherwise while the
    // code did it (Aster, CHANGES-REQUIRED 6af3ed6).
    const pointer = lastPointerType.current;
    lastPointerType.current = null;
    if (!isLong) return;
    if (!isMousePointer(pointer)) return;
    if (e.target.closest('a, button, iframe')) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    setArmed(a => !a);
  };

  // Deliberately does NOT arm: overflow:hidden still honors programmatic
  // scrolls, so a step needs no live scroll container — and on touch, arming
  // from an arrow tap would stick (nothing disarms without a mouse).
  const scrollStep = (dir) => {
    panelRef.current?.scrollBy({ top: dir * arrowStep(), behavior: 'smooth' });
  };

  // Resolve the sender's signed author-class on demand (cached in the store, one
  // pull per author) so the badge paints even for messages that arrived before
  // the client-side resolver ran (e.g. replayed history).
  useLayoutEffect(() => {
    if (signerPubkey) AxonaChatClient.resolveAuthorClass(signerPubkey);
  }, [signerPubkey]);

  if (!payload) return null;

  // Author-class is provenance, NOT a read gate (kernel: "absence means
  // UNSTATED, never a default"). Undeclared authors render normally, just
  // WITHOUT a class badge — they are never hidden. Only 'human'/'agent' badge.
  //
  // 'instrument' joins human and agent (David, council seq 449): the field names
  // the NATURE OF THE SOURCE of the data — human, agent, instrument — while
  // 'stream' would have described the data itself. An instrument makes no
  // claims; it reports readings, and a reader should bring calibration-and-
  // failure-mode scepticism rather than the kind you bring to an argument.
  //
  // NOTE THE SOURCE OF THIS VALUE. It is the kernel's SIGNED ATTESTATION keyed
  // by the authenticated signer, never the in-body `authorClass` string, which
  // any publisher can type. An instrument badge that could be self-asserted
  // would be worth nothing — the badge's whole value is that it is not the
  // claim. So a body that says 'instrument' gets NO badge until the signer
  // attests it, which is the correct fail-safe and not an oversight.
  const badgeClass = BADGES[resolvedClass] ? resolvedClass : null;


  const isOwn = currentHandle && signerPubkey === currentHandle.authorId;

  // The structured half of an instrument payload, when there is one. Accepts an
  // OBJECT in `data` (what axona.track sends) and otherwise tries the body text
  // as JSON — a publisher that sends only a JSON string still gets a tree.
  // Arrays and objects qualify; a bare number or string does not, because a tree
  // of one primitive is just the text again. Parsing is wrapped: a body that
  // merely LOOKS like JSON must not throw inside a render.
  // A RAW PUBLISH: the body is a bare string with no std/message wrapper around
  // it, so there is no handle, no authorClass and no text field — the whole
  // payload IS the string. axona.track publishes this way, and before this the
  // result was a tile reading "Anonymous" with no body at all, because every
  // field the renderer looked for was undefined on a string.
  //
  // An open topic will carry raw publishes whether or not we would prefer
  // envelopes, so the reader has to cope with one rather than render a blank.
  const isRawPublish = typeof payload === 'string';

  const parseJsonish = (s) => {
    if (typeof s !== 'string') return null;
    const t = s.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) return null;
    if (t.length > 64 * 1024) return null;       // do not parse an unbounded body
    try {
      const parsed = JSON.parse(t);
      return parsed !== null && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
  };

  const structuredPayload = (() => {
    if (isRawPublish) return parseJsonish(payload);
    const d = payload.data;
    if (d !== null && typeof d === 'object') return d;
    return parseJsonish(payload.text);
  })();

  // The class the publisher TYPED into its own body, which is a CLAIM and not
  // evidence. Read ONLY to render it as a claim (the dashed chip in the header),
  // never to produce the solid badge — `badgeClass` above comes from the signed
  // attestation and from nothing else. For a raw publish the claim lives inside
  // the JSON itself, so an instrument publishing unwrapped still shows what it
  // says it is. Declared AFTER isRawPublish/structuredPayload, which it reads.
  const selfDeclaredClass = (() => {
    const c = isRawPublish ? structuredPayload?.authorClass : payload.authorClass;
    return typeof c === 'string' && c.length > 0 && c.length < 32 ? c : null;
  })();

  // WHO IS THIS FROM, when the envelope carries no handle. David (council 476):
  // "(unwrapped publish)" says what went wrong, not who is speaking, and a
  // reader wants the second. A raw payload usually names itself somewhere — a
  // device slug, a handle, a name — so look, in a fixed order, and say where it
  // came from rather than passing it off as an envelope handle.
  //
  // This is a DISPLAY FALLBACK, not identity. Anything inside the body is
  // self-asserted, exactly like authorClass; the authenticated fact is the
  // signer, which is shown beside it as it always was. The publisher wrapping
  // properly remains the real fix.
  const bodyName = (() => {
    if (!isRawPublish || !structuredPayload) return null;
    for (const k of ['handle', 'deviceName', 'name', 'deviceId']) {
      const v = structuredPayload[k];
      if (typeof v === 'string' && v.trim() && v.length < 64) return v.trim();
    }
    return null;
  })();

  // DATE + time, never time alone (user-reported 2026-07-25). A time-only stamp is
  // actively misleading on this network: replayed history arrives interleaved with
  // live traffic, so a message from YESTERDAY renders next to one from a minute ago
  // and a bare "14:32" reads as today. That cost real debugging time — a stamp two
  // hours "in the future" turned out to be the previous day.
  //
  // Rendered in the VIEWER's local zone (kernel `ts` is epoch ms, i.e. UTC), which
  // is what a reader expects. The full weekday/date/time/zone goes in `title` so
  // hovering disambiguates absolutely, including the zone.
  const when = new Date(ts);
  const formattedTime = Number.isFinite(when.getTime())
    ? when.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  const fullTimestamp = Number.isFinite(when.getTime())
    ? when.toLocaleString([], {
        weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
      })
    : 'no timestamp';

  // Handle Delete (Kill message)
  const handleDelete = async () => {
    try {
      await AxonaChatClient.deleteOwnMessage(activeTopic, msgId);
      // Optimistic removal
      useChatStore.getState().killMessage(useChatStore.getState().activeTopicId, msgId);
    } catch (err) {
      console.error('Retraction failed traceback:', err);
      alert('retraction failed: ' + err.message);
    }
  };

  // Helper to detect and render embedded URLs
  const renderEmbeds = (text) => {
    if (typeof text !== 'string') return null;

    // URL extraction lives in services/messageUrls.js — a pure function with its
    // own regression tests, because this is exactly where the unfurl and the
    // rendered anchor used to disagree (Joi, #general 2026-07-27): the anchor
    // came from ReactMarkdown's parsed href while the preview came from a raw
    // text scan that ran through the markdown syntax. Both now agree by
    // construction — link syntax is parsed for its href, never scanned.
    const candidates = extractUrls(text);

    const imgMatches = candidates.filter(isImageUrl);

    // Match youtube links
    const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
    const ytMatch = text.match(ytRegex);

    // Topic links render as their own chip (and would 404 a link-preview fetch).
    // isAxonaNameUrl: a pasted `[Axona.bot](http://Axona.bot)` reaches here as a
    // REAL href, so suppressing the autolink in the renderer was not enough —
    // it still built a preview card (and a favicon fetch) for a host that does
    // not exist. Bare axona.* hosts get no card; axona.net WITH a path still does.
    const previewUrls = candidates.filter(
      (url) => !isImageUrl(url) && !isYouTubeUrl(url) && !isTopicLink(url) && !isAxonaNameUrl(url)
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        {imgMatches && imgMatches.map((url, idx) => (
          <div key={idx} style={{ maxWidth: '100%', maxHeight: '300px', overflow: 'hidden', borderRadius: '4px' }}>
            <img 
              src={url} 
              alt="Embedded" 
              style={{ maxWidth: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} 
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        ))}
        {ytMatch && (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px', maxWidth: '400px' }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytMatch[1]}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            />
          </div>
        )}
        {previewUrls.map((url, idx) => (
          <LinkPreview key={`link-${idx}`} url={url} />
        ))}
      </div>
    );
  };

  // A raw publish that is NOT JSON still has content — the string itself. A raw
  // publish that IS JSON has its content in the tree above, so leaving the text
  // empty avoids printing the same braces twice.
  const displayText = isRawPublish
    ? (structuredPayload ? '' : payload)
    : (payload.isEncrypted ? payload.decryptedText : payload.md || payload.text || '');

  // Copy the WHOLE message source — especially useful for long messages,
  // where only part of the text is on screen at once.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — leave it silent;
      // the text is still on screen.
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      padding: '0.75rem',
      borderRadius: 'var(--radius)',
      background: payload.isEncrypted 
        ? 'var(--color-success-bg)' 
        : 'var(--color-surface)',
      border: '1px solid var(--border-color)',
      borderLeft: payload.isEncrypted 
        ? '3px solid var(--color-success)' 
        : isOwn ? '3px solid var(--color-primary)' : '1px solid var(--border-color)',
      marginBottom: '0.5rem',
      marginLeft: `${level * 1.2}rem`,
      animation: 'rise 0.25s ease-out'
    }}>
      {/* Sender Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: isOwn ? 'var(--color-primary)' : 'var(--color-text)', fontSize: '0.85rem' }}>
            {isRawPublish
              ? (bodyName
                  ? <span title="This name comes from inside the message body, not from a std/message envelope handle — the publisher named itself. The authenticated fact is the signer shown beside it.">{bodyName}</span>
                  : <span title="Published without a std/message envelope and naming nothing inside its body, so there is no handle to show. The signer is still authenticated.">(unwrapped publish)</span>)
              : (payload.handle || 'Anonymous')}
          </span>
          {isRawPublish && bodyName && (
            <span
              title="The name shown was read from the message body rather than an envelope handle."
              style={{ fontSize: '0.55rem', color: 'var(--color-muted)', fontWeight: '600' }}
            >
              from body
            </span>
          )}

          {/* SELF-DECLARED CLASS, shown DISTINCTLY from an attested one.
              A publisher can type authorClass into its own body; that is a
              CLAIM, and the solid badge above is reserved for the kernel's
              signed attestation. But refusing to show the claim at all left a
              reader unable to see that a stream calls itself an instrument,
              which is information they want. So: show it, in outline rather
              than fill, and say "self-declared" on the chip itself. The two
              must never be confusable at a glance — that is the whole reason
              the attested badge is worth anything. */}
          {!badgeClass && selfDeclaredClass && (
            <span
              // WHAT ABSENCE OF A BADGE ACTUALLY MEANS (Aster, council seq 474).
              // My first wording said "the signer has published no signed class
              // for this key". `!badgeClass` does not establish that. An
              // attestation this client does not SUPPORT — a class outside the
              // BADGES table, such as 'service' — also produces no badge, and a
              // class absent locally may simply not have resolved rather than
              // never have been published. The honest statement is about what
              // is available HERE.
              title={`This publisher's own message body says "${selfDeclaredClass}". No supported signed-class attestation is available to this client, so this label comes from the message body — a claim, not a fact. A signed class would authenticate who declared it, not that it is true.`}
              style={{
                fontSize: '0.6rem',
                padding: '0px 5px',
                borderRadius: '10px',
                background: 'transparent',
                border: '1px dashed var(--color-muted)',
                color: 'var(--color-muted)',
                fontWeight: '600'
              }}
            >
              {selfDeclaredClass.toUpperCase()} · self-declared
            </span>
          )}
          
          {/* Badge the SIGNED author-class attestation, when declared. The
              signature authenticates WHO declared, not that the declaration is
              true. Undeclared authors simply get no badge — never hidden. */}
          {badgeClass && (
            <span
              title={BADGES[badgeClass].hint}
              style={{
                fontSize: '0.6rem',
                padding: '1px 5px',
                borderRadius: '10px',
                background: BADGES[badgeClass].bg,
                color: BADGES[badgeClass].fg,
                fontWeight: '600'
              }}
            >
              {BADGES[badgeClass].label}
            </span>
          )}

          {payload.isEncrypted && (
            <span style={{
              fontSize: '0.6rem',
              padding: '1px 5px',
              borderRadius: '10px',
              background: 'var(--color-success-bg)',
              color: 'var(--color-success)',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              🔒 PRIVATE
            </span>
          )}

          <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)' }}>
            {signerPubkey?.slice(0, 10)}...
          </span>
        </div>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
          {isOwn && pendingSend && (
            <span
              title={pendingSend.island
                ? 'Sent while disconnected — no other node has received this yet. It will be re-sent automatically when the connection recovers.'
                : 'Awaiting delivery confirmation from the network.'}
              style={{
                fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: '10px',
                background: pendingSend.island ? 'rgba(231, 76, 60, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                color: pendingSend.island ? '#e74c3c' : '#b7950b'
              }}
            >
              {pendingSend.island ? '⚠ NOT DELIVERED' : 'SENDING…'}
            </span>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }} title={fullTimestamp}>
            {formattedTime}
          </span>
        </span>
      </div>

      <div
        onPointerDown={notePointer}
        onClick={handlePanelClick}
        onMouseLeave={() => setArmed(false)}
        // The hint and the pointer cursor are mouse affordances. They key off
        // hover capability, which is the right question for "will a cursor
        // ever be here" — unlike ARMING, which must key off the pointer that
        // actually touched the tile.
        title={isLong && !armed && canHover ? 'Long message — click to scroll it in place' : undefined}
        style={isLong ? { position: 'relative', cursor: armed || !canHover ? 'auto' : 'pointer' } : undefined}
      >
        <div
          ref={panelRef}
          onScroll={updateEdges}
          style={isLong ? {
            maxHeight: `${panelH()}px`,
            overflowY: armed ? 'auto' : 'hidden',
            // Contain ONLY while armed. Unarmed it must be 'auto': some
            // engines treat an overflow:hidden box as a scroll container,
            // and 'contain' on it would suppress the very chaining that
            // lets the unarmed wheel fall through to the message list
            // (Aster, b0c204e — the fall-through claim must be encoded,
            // not assumed).
            overscrollBehavior: armed ? 'contain' : 'auto',
            borderRadius: '4px',
            // A quiet ring while armed, so it's visible which surface the
            // wheel now drives.
            boxShadow: armed ? '0 0 0 1px var(--color-primary) inset' : 'none',
            transition: 'box-shadow 0.15s ease'
          } : undefined}
        >
        <div
          ref={contentRef}
          className="message-content"
          style={{
            fontSize: '0.9rem', lineHeight: '1.4', wordBreak: 'break-word', color: 'var(--color-text)'
          }}
        >
          {/* A STRUCTURED PAYLOAD RENDERS AS STRUCTURE, not as a wall of braces.
              Instrument publishers (axona.track) send a `data` object beside the
              human-readable `text`; when it is there, show the tree — collapsible,
              budgeted, and rendered as TEXT. The markdown path still runs for the
              `text`, so a reader gets the summary and the detail rather than one
              or the other. David, council seq 433. */}
          {structuredPayload && (
            <JsonView value={structuredPayload} title="STRUCTURED PAYLOAD" />
          )}
          <ReactMarkdown
            // GFM: tables, strikethrough, task lists, autolinks — a pasted
            // markdown document must render whole, not a subset (§7.2).
            // remark-breaks: a single newline becomes a hard line break, so
            // pasted multi-line text keeps its line structure instead of
            // Markdown collapsing single newlines into spaces (§6.3).
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a: ({ href, children }) =>
                isAxonaName(href, children) ? (
                  // An axona.* NAME, not an address — render as plain text.
                  <>{children}</>
                ) : isTopicLink(href) ? (
                  <TopicLinkChip href={href}>{children}</TopicLinkChip>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              // Wide tables scroll inside their own container instead of
              // stretching the message pane.
              table: ({ children }) => (
                <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <table>{children}</table>
                </div>
              )
            }}
          >
            {displayText}
          </ReactMarkdown>
          {renderEmbeds(displayText)}
        </div>
        </div>

        {/* Edge affordances: each fade says "there is more this way", each
            arrow steps it. Both exist only while that direction can move, so
            their absence is the completion signal. pointerEvents:none on the
            fades keeps text under them selectable and clickable. */}
        {isLong && canUp && (
          <>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '2.2rem',
              background: 'linear-gradient(to bottom, var(--color-surface), transparent)',
              pointerEvents: 'none', borderRadius: '4px 4px 0 0'
            }} />
            <button
              onClick={(e) => { e.stopPropagation(); scrollStep(-1); }}
              title="Scroll this message up"
              aria-label="Scroll this message up"
              style={{
                position: 'absolute', top: '0.25rem', left: '50%', transform: 'translateX(-50%)',
                width: '1.6rem', height: '1.6rem', borderRadius: '50%', cursor: 'pointer',
                border: '1px solid var(--border-color)', background: 'var(--color-surface)',
                color: 'var(--color-primary)', fontSize: '0.7rem', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
              }}
            >
              ▲
            </button>
          </>
        )}
        {isLong && canDown && (
          <>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '2.2rem',
              background: 'linear-gradient(to top, var(--color-surface), transparent)',
              pointerEvents: 'none', borderRadius: '0 0 4px 4px'
            }} />
            <button
              onClick={(e) => { e.stopPropagation(); scrollStep(1); }}
              title="Scroll this message down"
              aria-label="Scroll this message down"
              style={{
                position: 'absolute', bottom: '0.25rem', left: '50%', transform: 'translateX(-50%)',
                width: '1.6rem', height: '1.6rem', borderRadius: '50%', cursor: 'pointer',
                border: '1px solid var(--border-color)', background: 'var(--color-surface)',
                color: 'var(--color-primary)', fontSize: '0.7rem', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
              }}
            >
              ▼
            </button>
          </>
        )}
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem', justifyContent: 'flex-end', fontSize: '0.7rem' }}>
        <span
          onClick={handleCopy}
          title="Copy the full message text — grabs the whole message, not just the visible part"
          style={{ color: copied ? 'var(--color-success)' : 'var(--color-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => { if (!copied) e.target.style.color = 'var(--color-primary)'; }}
          onMouseLeave={(e) => { if (!copied) e.target.style.color = 'var(--color-muted)'; }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </span>

        <span
          onClick={() => onReply(envelope)}
          title="Reply publicly — your reply appears nested under this message"
          style={{ color: 'var(--color-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
          onMouseEnter={(e) => e.target.style.color = 'var(--color-primary)'}
          onMouseLeave={(e) => e.target.style.color = 'var(--color-muted)'}
        >
          Reply
        </span>

        {/* Can private-reply if not own message */}
        {!isOwn && (
          <span
            onClick={() => onPrivateReply(envelope)}
            title="Reply privately — only this message's author can read it, and it can open a private channel between you"
            style={{ color: 'var(--color-muted)', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--color-success)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--color-muted)'}
          >
            Private Reply
          </span>
        )}

        {/* Retraction option (Kill own message) */}
        {isOwn && (
          showConfirm ? (
            <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.68rem' }}>Confirm retract?</span>
              <button 
                onClick={handleDelete}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '1px 6px',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Yes
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  padding: '0px 6px',
                  fontSize: '0.65rem',
                  cursor: 'pointer'
                }}
              >
                No
              </button>
            </span>
          ) : (
            <span
              onClick={() => setShowConfirm(true)}
              title="Take back your message — it is removed for everyone, not just you"
              style={{ color: '#e74c3c', cursor: 'pointer' }}
            >
              Retract (✕)
            </span>
          )
        )}
      </div>
    </div>
  );
};

export default Message;
