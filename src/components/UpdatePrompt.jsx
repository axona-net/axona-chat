import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// SERVICE-WORKER UPDATE POLICY — applies itself, and never over your typing.
//
// WHY THIS IS NOT A PROMPT ANY MORE. Until 0.57.0 a new deploy raised a toast
// with a Reload button and a ✕ to dismiss, so nothing updated without a click.
// That is the right policy for an app whose old build still WORKS. This app's
// old build does not: the kernel pin is part of the bundle, and a client left
// on a superseded kernel can reach the bridge and then never form a mesh. The
// user sees "connecting" forever with no error, which reads as an outage, not
// as a version problem.
//
// It has cost us the same day twice. On 2026-09-04 (chat 366e4b8) "Safari can't
// connect" was chased through ICE diagnostics before the cause turned out to be
// this: Safari's worker was still serving the pre-4.75 build against an all-4.75
// fleet, while Chromium and Firefox had refreshed. The remedy recorded then was
// "a cache clear, not a code change" — which fixes one browser on one day and
// guarantees a recurrence at the next kernel bump. It recurred on 2026-09-08,
// and the precache on a machine here still held FOUR builds, the oldest a 4.75.1
// from that first incident. A manual remedy for a condition that regenerates
// every release is not a remedy.
//
// WHAT IS PRESERVED. The original concern was real — never destroy work the user
// has not sent. The composer keeps its draft in a ref (Composer.jsx), so a reload
// loses whatever is half-typed. So this does not reload while the user is
// editing: it waits for the field to lose focus, or for the tab to be hidden,
// and applies then. The user can also apply it immediately.
//
// WHY registerType STAYS 'prompt'. 'autoUpdate' makes vite-plugin-pwa call
// skipWaiting the moment a worker installs, which would reload mid-sentence and
// removes any chance to defer. Keeping the registration message-gated leaves the
// decision here, in the app, where it can see the caret. This file simply sends
// the message on the user's behalf instead of waiting for a click — and it is
// also what keeps workbox's `clientsClaim` safe, exactly as vite.config.js says.
const CHECK_INTERVAL_MS = 60 * 1000;   // re-check every minute while a tab stays open
const APPLY_GRACE_MS    = 2500;        // let the notice render before the reload
const BUSY_RECHECK_MS   = 2000;        // how often to re-ask "still typing?"

/** True while the caret sits in something the user could be composing into. */
function userIsEditing() {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

const UpdatePrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => { registration.update().catch(() => {}); };
      setInterval(check, CHECK_INTERVAL_MS);
      // Refocusing the tab is the most common "am I a deploy behind?" moment.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('online', check);
    }
  });

  // Reload the moment the new worker takes control. Backstop to
  // vite-plugin-pwa's own 'controlling' listener, which does not fire for a tab
  // the previous worker never controlled — the case that made an earlier Reload
  // button appear to do nothing. Armed only when we actually apply, and guarded
  // so it runs exactly once.
  const reloadedRef = React.useRef(false);
  const apply = React.useCallback(() => {
    if (reloadedRef.current) return;
    reloadedRef.current = true;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const [deferred, setDeferred] = React.useState(false);

  React.useEffect(() => {
    if (!needRefresh) return undefined;
    let cancelled = false;
    let timer = null;

    const attempt = () => {
      if (cancelled) return;
      if (userIsEditing()) {
        setDeferred(true);
        timer = setTimeout(attempt, BUSY_RECHECK_MS);
        return;
      }
      setDeferred(false);
      apply();
    };

    timer = setTimeout(attempt, APPLY_GRACE_MS);

    // A hidden tab is the safest possible moment — nothing is being typed into
    // it and the reload finishes before the user looks again.
    const onHide = () => { if (document.visibilityState === 'hidden') attempt(); };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [needRefresh, apply]);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '54px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        padding: '0.7rem 1rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '999px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        fontSize: '0.82rem',
        color: 'var(--color-text)',
        maxWidth: 'calc(100vw - 2rem)'
      }}
    >
      <span>
        {deferred
          ? '✨ Update ready — will apply when you finish typing.'
          : '✨ Updating Axona Chat to the latest version…'}
      </span>
      {deferred && (
        <button
          onClick={apply}
          title="Reload now — an unsent draft will be lost"
          style={{
            padding: '0.3rem 0.9rem',
            fontWeight: '700',
            fontSize: '0.8rem',
            border: 'none',
            borderRadius: '999px',
            background: 'var(--color-primary)',
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Now
        </button>
      )}
    </div>
  );
};

export default UpdatePrompt;
