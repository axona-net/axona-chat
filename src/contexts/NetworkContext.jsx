import React, { createContext, useContext, useState } from 'react';

// NetworkContext provides the bridge URL and network/region selection.
const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
  // Use wss:// testnet bridge as specified in the quick start guide
  const [bridgeUrl, setBridgeUrl] = useState('wss://testnet.axona.net');
  const [network, setNetwork] = useState('testnet'); // or 'production'
  const [region, setRegion] = useState('useast');

  const value = { 
    bridgeUrl, 
    setBridgeUrl, 
    network, 
    setNetwork, 
    region, 
    setRegion 
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
