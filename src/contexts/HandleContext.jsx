import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { set, get } from 'idb-keyval';
import { createAuthorIdentity } from '@axona/protocol';

const HandleContext = createContext();

export const HandleProvider = ({ children }) => {
  const [handles, setHandles] = useState([]);
  const [activeHandleId, setActiveHandleId] = useState(null);
  const [declaration, setDeclaration] = useState('human'); // 'human' | 'agent' | 'unstated'

  // Load persisted handles & active handle ID & declaration on mount
  useEffect(() => {
    const load = async () => {
      try {
        const persistedHandles = await get('axona-handles');
        const persistedActiveId = await get('axona-active-handle-id');
        const persistedDecl = await get('axona-global-declaration');

        if (persistedHandles) {
          setHandles(persistedHandles);
        }
        if (persistedActiveId) {
          setActiveHandleId(persistedActiveId);
        } else if (persistedHandles && persistedHandles.length > 0) {
          setActiveHandleId(persistedHandles[0].id);
        }
        if (persistedDecl) {
          setDeclaration(persistedDecl);
        }
      } catch (err) {
        console.warn('IndexedDB load failed, trying localStorage:', err);
        try {
          const persistedHandles = JSON.parse(localStorage.getItem('axona-handles'));
          const persistedActiveId = localStorage.getItem('axona-active-handle-id');
          const persistedDecl = localStorage.getItem('axona-global-declaration');

          if (persistedHandles) setHandles(persistedHandles);
          if (persistedActiveId) setActiveHandleId(persistedActiveId);
          if (persistedDecl) setDeclaration(persistedDecl);
        } catch (errLocal) {
          console.warn('localStorage fallback load failed:', errLocal);
        }
      }
    };
    load();
  }, []);

  // Persist handles whenever they change. Persist the EMPTY list too —
  // otherwise deleting the last persona resurrects it on reload.
  const handlesLoaded = React.useRef(false);
  useEffect(() => {
    if (!handlesLoaded.current) { handlesLoaded.current = true; return; }
    try {
      set('axona-handles', handles);
      localStorage.setItem('axona-handles', JSON.stringify(handles));
    } catch (err) {
      console.warn('Handles persistence failed:', err);
    }
  }, [handles]);

  // Persist active handle ID
  useEffect(() => {
    if (activeHandleId) {
      try {
        set('axona-active-handle-id', activeHandleId);
        localStorage.setItem('axona-active-handle-id', activeHandleId);
      } catch (err) {
        console.warn('Active handle ID persistence failed:', err);
      }
    }
  }, [activeHandleId]);

  // Persist declaration
  useEffect(() => {
    try {
      set('axona-global-declaration', declaration);
      localStorage.setItem('axona-global-declaration', declaration);
    } catch (err) {
      console.warn('Declaration persistence failed:', err);
    }
  }, [declaration]);

  const createHandle = async (name) => {
    const handleId = uuidv4();
    const persistKey = `axona-author-${handleId}`;

    // Create the cryptographic author identity immediately
    const authorIdentity = await createAuthorIdentity({ persistAs: persistKey });

    const newHandle = {
      id: handleId,
      name,
      authorId: authorIdentity.authorId, // The 64-hex public Author ID
      authorRef: persistKey,
    };

    setHandles((h) => [...h, newHandle]);
    setActiveHandleId(handleId);
    return newHandle;
  };

  const importHandle = async (name, keyEnvelopeJson) => {
    const handleId = uuidv4();
    const persistKey = `axona-author-${handleId}`;

    try {
      // Validate structure of the JSON envelope
      const env = JSON.parse(keyEnvelopeJson);
      if (!env.pubkey || !env.privkey) {
        throw new Error('Invalid key envelope format. Missing pubkey or privkey.');
      }

      // Save key envelope to localStorage so createAuthorIdentity can load it
      try {
        localStorage.setItem(persistKey, keyEnvelopeJson);
      } catch (errLocal) {
        console.warn('localStorage write failed inside importHandle:', errLocal);
      }

      // Load it via the protocol API to check correctness
      const authorIdentity = await createAuthorIdentity({ persistAs: persistKey });

      const imported = {
        id: handleId,
        name,
        authorId: authorIdentity.authorId,
        authorRef: persistKey,
      };

      setHandles((h) => [...h, imported]);
      setActiveHandleId(handleId);
      return imported;
    } catch (err) {
      console.error('Import failed:', err);
      throw err;
    }
  };

  const deleteHandle = async (id) => {
    setHandles((h) => {
      const filtered = h.filter((handle) => handle.id !== id);
      if (activeHandleId === id) {
        setActiveHandleId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
    // Remove stored identity from localStorage
    try {
      localStorage.removeItem(`axona-author-${id}`);
    } catch (errLocal) {
      console.warn('localStorage remove failed inside deleteHandle:', errLocal);
    }
  };

  const activeHandle = handles.find((h) => h.id === activeHandleId) || null;

  return (
    <HandleContext.Provider
      value={{
        handles,
        activeHandle,
        setActiveHandleId,
        createHandle,
        importHandle,
        deleteHandle,
        declaration,
        setDeclaration,
      }}
    >
      {children}
    </HandleContext.Provider>
  );
};

export const useHandle = () => useContext(HandleContext);
