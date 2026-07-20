import React, { useEffect } from 'react';
import ChatShell from './components/ChatShell.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';
import { useChatStore } from './stores/useChatStore.js';
import { readTopicFromLocation, clearTopicFromLocation } from './services/topicLink.js';

function App() {
  const { theme } = useChatStore();

  useEffect(() => {
    document.body.className = `${theme}-theme`;
  }, [theme]);

  // Deep link: if the app was launched with a topic link (…/#topic=…), add that
  // topic to the user's list and open it, then strip the token from the URL so a
  // refresh doesn't re-trigger. Writing to the store persists it; the normal
  // subscription reconcile picks it up once the peer connects (post-onboarding).
  useEffect(() => {
    const descriptor = readTopicFromLocation();
    if (!descriptor) return;
    const { addTopic, setActiveTopic } = useChatStore.getState();
    const topic = {
      region: descriptor.region,
      name: descriptor.name,
      owner: descriptor.owner || undefined,
      write: descriptor.write || (descriptor.owner ? 'owner' : 'open'),
    };
    addTopic(topic);
    setActiveTopic(topic);
    clearTopicFromLocation();
  }, []);

  return (
    <div className="glass" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <OnboardingGate>
        <ChatShell />
      </OnboardingGate>
    </div>
  );
}

export default App;
