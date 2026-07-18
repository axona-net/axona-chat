import React, { useEffect } from 'react';
import ChatShell from './components/ChatShell.jsx';
import OnboardingGate from './components/OnboardingGate.jsx';
import { useChatStore } from './stores/useChatStore.js';

function App() {
  const { theme } = useChatStore();

  useEffect(() => {
    document.body.className = `${theme}-theme`;
  }, [theme]);

  return (
    <div className="glass" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <OnboardingGate>
        <ChatShell />
      </OnboardingGate>
    </div>
  );
}

export default App;
