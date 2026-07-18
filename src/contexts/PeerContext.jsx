import React, { createContext, useContext, useEffect, useState } from 'react';
import { connect } from '@axona/protocol/connect.js';
import { useNetwork } from './NetworkContext.jsx';
import AxonaChatClient from '../services/AxonaChatClient.js';

const PeerContext = createContext();

export const PeerProvider = ({ children }) => {
  const { bridgeUrl } = useNetwork();
  const [peer, setPeer] = useState(null);
  const [status, setStatus] = useState({ ready: false, peers: 0, ms: 0, reason: 'connecting' });
  // Dev diagnostic: mesh dial outcomes, surfaced on-screen (see strip below).
  const [meshDiag, setMeshDiag] = useState({ ok: 0, failed: 0 });

  useEffect(() => {
    let active = true;
    let cleanup = null;
    let interval = null;

    // First run only: wait for onboarding to finish so the connection can
    // use the location the user just granted (or explicitly skipped).
    // Returning users (onboarded flag, or pre-feature installs that already
    // have handles) connect immediately.
    const isOnboarded = () => {
      try {
        return !!(localStorage.getItem('axona-onboarded') || localStorage.getItem('axona-handles'));
      } catch { return true; }
    };
    const waitForOnboarding = () => new Promise((resolve) => {
      if (isOnboarded()) return resolve();
      const done = () => { window.removeEventListener('axona-onboarded', done); resolve(); };
      window.addEventListener('axona-onboarded', done);
    });

    const storedLocation = () => {
      try {
        const raw = localStorage.getItem('axona-node-location');
        const loc = raw ? JSON.parse(raw) : null;
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return loc;
      } catch { /* fall through */ }
      return { lat: 38.0, lng: -77.0 };   // default region (US East)
    };

    const init = async () => {
      setStatus({ ready: false, peers: 0, ms: 0, reason: 'connecting' });
      try {
        await waitForOnboarding();
        const location = storedLocation();

        if (!active) return;

        // ONE peer for the whole session. Authorship is per-call: every
        // publish/kill passes { signWith } with the active handle's author
        // key (AxonaChatClient.getActiveAuthor), so switching handles must
        // NOT reconnect — tearing down live WebRTC meshes per persona switch
        // churned the mesh and spammed ICE failures. author:false because
        // connect()'s minted default author is never used.
        const connectionOpts = {
          bridge: bridgeUrl,
          location,
          author: false,
          ready: { minPeers: 1, timeoutMs: 8000 }
        };

        const result = await connect(connectionOpts);

        if (!active) {
          if (result.disconnect) result.disconnect();
          return;
        }

        setPeer(result.peer);
        AxonaChatClient.setPeer(result.peer);
        setStatus(result.status || { ready: true, peers: 1, ms: 0, reason: 'connected' });

        // Attribute mesh dial failures. Firefox prints "WebRTC: ICE failed,
        // your TURN server appears to be broken" once per peer connection
        // whose ICE fails — on a churny testnet that's a dial to a peer that
        // just left (or one that can't do TURN from ITS side), not a TURN
        // outage. Log WHICH peer failed alongside each warning so the noise
        // is attributable.
        for (const lvl of ['debug', 'info', 'warn']) {
          try {
            result.peer.onLog(lvl, (evt, data) => {
              if (evt === 'pc-state' && data) {
                if (data.pc === 'failed') {
                  console.debug(
                    `[axona-mesh] dial to peer ${String(data.peerId).slice(0, 10)}… failed ` +
                    '(remote peer churned or cannot relay — not a local TURN problem)'
                  );
                  setMeshDiag(d => ({ ...d, failed: d.failed + 1 }));
                } else if (data.pc === 'connected') {
                  setMeshDiag(d => ({ ...d, ok: d.ok + 1 }));
                }
              }
            });
          } catch { /* level not supported — ignore */ }
        }
        cleanup = () => {
          AxonaChatClient.setPeer(null);
          if (result.disconnect) result.disconnect();
        };

        // Monitor peer synaptome size for status updates
        interval = setInterval(() => {
          if (result.peer) {
            const peersCount = result.peer.peers ? result.peer.peers().length : 0;
            setStatus(prev => ({
              ...prev,
              ready: peersCount > 0,
              peers: peersCount,
              reason: peersCount > 0 ? 'connected' : 'seeking-peers'
            }));
          }
        }, 5000);

      } catch (err) {
        console.error('Peer connection failed:', err);
        if (active) {
          setStatus({ ready: false, peers: 0, ms: 0, reason: err.message || 'connection-failed' });
        }
      }
    };

    init();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [bridgeUrl]); // Reconnect ONLY on bridge change — never on handle switch

  return (
    <PeerContext.Provider value={{ peer, status }}>
      {children}
      {/* Dev-only mesh diagnostic strip — visible even over the onboarding
          gate so connection health is observable without the console. */}
      {import.meta.env.DEV && (
        <div style={{
          position: 'fixed', bottom: 2, left: 2, zIndex: 9999,
          fontFamily: 'monospace', fontSize: 11, lineHeight: 1.2,
          background: 'rgba(0,0,0,0.75)', color: '#9f9',
          padding: '2px 8px', borderRadius: 4, pointerEvents: 'none'
        }}>
          mesh: {status.reason} · peers {status.peers} · dials ok {meshDiag.ok} / failed {meshDiag.failed}
        </div>
      )}
    </PeerContext.Provider>
  );
};

export const usePeer = () => useContext(PeerContext);
