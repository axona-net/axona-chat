import React, { useState, useEffect } from 'react';
import TopicTicker from './TopicTicker.jsx';
import StatusFooter from './StatusFooter.jsx';
import ChannelList from './ChannelList.jsx';
import MessagePane from './MessagePane.jsx';
import Composer from './Composer.jsx';
import PresenceRail from './PresenceRail.jsx';
import Modals from './Modals.jsx';
import { usePeer } from '../contexts/PeerContext.jsx';
import { useHandle } from '../contexts/HandleContext.jsx';
import { useChatStore } from '../stores/useChatStore.js';
import AxonaChatClient from '../services/AxonaChatClient.js';

const ChatShell = () => {
  const { peer } = usePeer();
  const { activeHandle, declaration } = useHandle();

  const [activeModal, setActiveModal] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [privateReplyTarget, setPrivateReplyTarget] = useState(null);
  
  // Mobile responsive tabs: 'channels' | 'chat' | 'presence'
  const [mobileTab, setMobileTab] = useState('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 800);

  // Sync peer to AxonaChatClient
  useEffect(() => {
    AxonaChatClient.setPeer(peer);
  }, [peer]);

  // Sync handle metadata to useChatStore
  useEffect(() => {
    useChatStore.setState({ 
      currentHandle: activeHandle,
      currentDeclaration: declaration 
    });
  }, [activeHandle, declaration]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 800);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Parse private invite queries from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteTopic = params.get('t');
    const inviteKey = params.get('k');

    // Deep link to a public topic: axona.chat?topic=<name>[&region=<region>].
    // URLSearchParams decodes %20/+ so legacy spaced names still reach the
    // right topic when properly encoded; newly created names carry no spaces.
    const linkedTopic = params.get('topic');
    if (linkedTopic && linkedTopic.trim() && !(inviteTopic && inviteKey)) {
      const linkedRegion = params.get('region') || 'useast';
      window.history.replaceState({}, document.title, window.location.pathname);
      const descriptor = { region: linkedRegion, name: linkedTopic.trim(), write: 'open' };
      useChatStore.getState().addTopic(descriptor);
      useChatStore.getState().setActiveTopic(descriptor);
      AxonaChatClient.reconcileSubscriptions();
      return;
    }

    if (inviteTopic && inviteKey) {
      // Clear query params from the URL so reloading doesn't prompt again
      window.history.replaceState({}, document.title, window.location.pathname);

      // Prompt to name the connection locally
      setTimeout(() => {
        const localName = window.prompt("You received a private channel invitation! Please enter a name for this connection:");
        if (localName && localName.trim()) {
          const descriptor = {
            region: 'useast',
            name: inviteTopic,
            description: `Private chat with ${localName.trim()}`,
            mode: 'encrypted',
            privateKey: inviteKey,
            write: 'open'
          };
          // Add to subscribedTopics in useChatStore
          useChatStore.getState().addTopic(descriptor);
          useChatStore.getState().setActiveTopic(descriptor);
          
          // Sync subscriptions
          AxonaChatClient.reconcileSubscriptions();
        }
      }, 500); // Small timeout to ensure active handle is fully synced
    }
  }, []);

  const handleOpenModal = (modalName) => {
    setActiveModal(modalName);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  const handleSetReply = (env) => {
    setPrivateReplyTarget(null);
    setReplyTarget(env);
  };

  const handleSetPrivateReply = (env) => {
    setReplyTarget(null);
    setPrivateReplyTarget(env);
  };

  const clearReplyTargets = () => {
    setReplyTarget(null);
    setPrivateReplyTarget(null);
  };

  // Render responsive layout
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--color-bg)',
      overflow: 'hidden'
    }}>
      {/* Ticker at the top */}
      <TopicTicker />

      {/* Main Container */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative'
      }}>
        
        {/* Left Column: Topics List (no OrgRail, full-width) */}
        <div style={{
          display: isMobile ? (mobileTab === 'channels' ? 'flex' : 'none') : 'flex',
          flexDirection: 'column',
          width: isMobile ? '100%' : '260px',
          borderRight: '1px solid var(--border-color)',
          background: 'var(--color-sidebar-bg)',
          height: '100%',
          padding: '1rem 0.75rem'
        }}>
          <ChannelList onOpenModal={handleOpenModal} />
        </div>

        {/* Center Column: MessagePane & Composer & StatusFooter */}
        <div style={{
          display: isMobile ? (mobileTab === 'chat' ? 'flex' : 'none') : 'flex',
          flexDirection: 'column',
          flex: 1,
          height: '100%',
          background: 'var(--color-column-bg)'
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MessagePane 
              onOpenModal={handleOpenModal} 
              setReplyTarget={handleSetReply}
              setPrivateReplyTarget={handleSetPrivateReply}
            />
          </div>
          <Composer 
            replyTarget={replyTarget} 
            privateReplyTarget={privateReplyTarget}
            clearReplyTargets={clearReplyTargets}
          />
        </div>

        {/* Right Column: Mobile-only Presence tab */}
        {isMobile && mobileTab === 'presence' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            background: 'rgba(20, 24, 30, 0.95)',
            padding: '1rem',
            height: '100%'
          }}>
            <PresenceRail />
          </div>
        )}
      </div>

      {/* StatusFooter spans full width under the sidebars */}
      <StatusFooter onOpenModal={handleOpenModal} />

      {/* Mobile navigation tab bar */}
      {isMobile && (
        <div style={{
          display: 'flex',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(20, 24, 30, 0.95)',
          height: '56px',
          zIndex: 10
        }}>
          <div 
            onClick={() => setMobileTab('channels')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              color: mobileTab === 'channels' ? 'var(--color-primary-light)' : 'var(--color-muted)',
              cursor: 'pointer'
            }}
          >
            💬 Channels
          </div>
          <div 
            onClick={() => setMobileTab('chat')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              color: mobileTab === 'chat' ? 'var(--color-primary-light)' : 'var(--color-muted)',
              cursor: 'pointer'
            }}
          >
            📝 Chat
          </div>
          <div 
            onClick={() => setMobileTab('presence')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              color: mobileTab === 'presence' ? 'var(--color-primary-light)' : 'var(--color-muted)',
              cursor: 'pointer'
            }}
          >
            👥 Members
          </div>
        </div>
      )}

      {/* Modals Handler */}
      <Modals activeModal={activeModal} onClose={handleCloseModal} />
    </div>
  );
};

export default ChatShell;
