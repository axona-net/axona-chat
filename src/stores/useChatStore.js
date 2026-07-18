import { create } from 'zustand';

// Helper to compute stable IDs for topics.
// write defaults to 'open' to MATCH THE KERNEL: deriveTopicId treats a
// missing write policy as 'open', so {name:'lobby'} and {name:'lobby',
// write:'open'} are the same topic on the network and must be the same
// row here (an ad carries write explicitly; the defaults omit it).
const getTopicId = (descriptor) => {
  if (!descriptor) return '';
  const region = descriptor.region || 'global';
  const owner = descriptor.owner || '';
  const name = descriptor.name || '';
  const write = descriptor.write || 'open';
  return `${region}:${owner}:${name}:${write}`;
};

// Subscribed topics persist locally so a returning user's full list is
// resurrected on rejoin. Descriptors are plain JSON (including any private
// channel's local key — consistent with handles' keys living in local
// storage). Falls back to the four default rooms on first run.
const AXONA_TOPIC = { region: 'useast', name: 'axona', description: 'talk to us' };
const DEFAULT_TOPICS = [
  AXONA_TOPIC,
  { region: 'useast', name: 'lobby', description: 'Public lobby for everyone' },
  { region: 'useast', name: 'tech', description: 'Tech discussions' },
  { region: 'useast', name: 'general', description: 'General chat' }
];

const loadPersistedTopics = () => {
  try {
    const raw = localStorage.getItem('axona-topics');
    const parsed = raw ? JSON.parse(raw) : null;
    let parsedDeduped = parsed;
    if (Array.isArray(parsed)) {
      // Heal duplicates persisted before write-policy normalization
      // (same kernel topic under two descriptor spellings).
      const seen = new Set();
      parsedDeduped = parsed.filter(t => {
        const id = getTopicId(t);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (parsedDeduped.length !== parsed.length) persistTopics(parsedDeduped);
    }
    if (Array.isArray(parsedDeduped) && parsedDeduped.length > 0 && parsedDeduped.every(t => t && t.name)) {
      // One-time seed: existing users get the axona topic prepended once.
      // The flag keeps a deliberate unsubscribe from being re-added.
      if (!localStorage.getItem('axona-topic-seeded')) {
        localStorage.setItem('axona-topic-seeded', '1');
        if (!parsedDeduped.some(t => getTopicId(t) === getTopicId(AXONA_TOPIC))) {
          const seeded = [AXONA_TOPIC, ...parsedDeduped];
          persistTopics(seeded);
          return seeded;
        }
      }
      return parsedDeduped;
    }
  } catch { /* corrupted or unavailable storage → defaults */ }
  try { localStorage.setItem('axona-topic-seeded', '1'); } catch { /* ignore */ }
  return DEFAULT_TOPICS;
};

const persistTopics = (topics) => {
  try {
    localStorage.setItem('axona-topics', JSON.stringify(topics));
  } catch { /* private mode — in-memory only */ }
};

export const useChatStore = create((set, get) => ({
  // Active states
  activeTopic: { region: 'useast', name: 'lobby' }, // Default open channel
  activeTopicId: 'useast::lobby:open',

  // Channels/Topics list
  subscribedTopics: loadPersistedTopics(),

  // Ticker (advertised topics)
  tickerVisible: true,
  advertisedTopics: [], // list of topic.ad payloads

  // Messages: map of topicId -> array of envelopes
  messages: {}, 

  // Moderation: queue for channel owners
  // Map of outputTopicId -> array of raw channel envelopes awaiting approval
  moderationQueue: {},

  // Private continuations: map of partnerAuthorId -> { topic, key, messages: [] }
  privateConversations: {},

  // Presence: map of authorId -> { handle, declaration, lastSeen }
  presence: {},
  topicMetrics: {},

  // Active handle and declaration (mirrored from HandleContext for easy store access)
  currentHandle: null,
  currentDeclaration: 'human',
  theme: (() => {
    try {
      return localStorage.getItem('axona-theme') || 'light';
    } catch {
      return 'light';
    }
  })(),

  // Actions
  updateTopicMetrics: (storeId, metrics) => set((state) => ({
    topicMetrics: {
      ...state.topicMetrics,
      [storeId]: metrics
    }
  })),
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('axona-theme', nextTheme);
    } catch (e) {
      console.warn('Failed to persist theme:', e);
    }
    document.body.className = nextTheme + '-theme';
    return { theme: nextTheme };
  }),

  setActiveTopic: async (topic) => {
    // Topic can be a descriptor
    const id = getTopicId(topic);
    set({ activeTopic: topic, activeTopicId: id });
  },

  setSubscribedTopics: (topics) => {
    persistTopics(topics);
    set({ subscribedTopics: topics });
  },

  addTopic: (topic) => {
    const exists = get().subscribedTopics.some(t => getTopicId(t) === getTopicId(topic));
    if (!exists) {
      const next = [...get().subscribedTopics, topic];
      persistTopics(next);
      set({ subscribedTopics: next });
    }
  },

  renameTopicLabel: (topic, nextLabel) => set((state) => {
    const updated = state.subscribedTopics.map(t => {
      if (getTopicId(t) === getTopicId(topic)) {
        return {
          ...t,
          description: `Private chat with ${nextLabel}`
        };
      }
      return t;
    });
    persistTopics(updated);
    return { subscribedTopics: updated };
  }),

  removeTopic: (topic) => {
    set(state => {
      const next = state.subscribedTopics.filter(t => getTopicId(t) !== getTopicId(topic));
      persistTopics(next);
      return { subscribedTopics: next };
    });
  },

  setTickerVisible: (visible) => set({ tickerVisible: visible }),

  addAdvertisement: (ad) => {
    // ad = { name, blurb, topicId, network, region, mode, postedAt }
    set(state => {
      const filtered = state.advertisedTopics.filter(item => item.topicId !== ad.topicId);
      return { advertisedTopics: [...filtered, ad] };
    });
  },

  addEnvelope: (topicId, envelope) => {
    set(state => {
      const topicMsgs = state.messages[topicId] || [];
      // Prevent duplicates
      if (topicMsgs.some(m => m.msgId === envelope.msgId)) return {};
      return {
        messages: {
          ...state.messages,
          [topicId]: [...topicMsgs, envelope]
        }
      };
    });
  },

  killMessage: (topicId, msgId) => {
    set(state => {
      const topicMsgs = state.messages[topicId] || [];
      return {
        messages: {
          ...state.messages,
          [topicId]: topicMsgs.filter(m => m.msgId !== msgId)
        }
      };
    });
  },

  addToModerationQueue: (outputTopicId, envelope) => {
    set(state => {
      const queue = state.moderationQueue[outputTopicId] || [];
      if (queue.some(m => m.msgId === envelope.msgId)) return {};
      return {
        moderationQueue: {
          ...state.moderationQueue,
          [outputTopicId]: [...queue, envelope]
        }
      };
    });
  },

  removeFromModerationQueue: (outputTopicId, msgId) => {
    set(state => {
      const queue = state.moderationQueue[outputTopicId] || [];
      return {
        moderationQueue: {
          ...state.moderationQueue,
          [outputTopicId]: queue.filter(m => m.msgId !== msgId)
        }
      };
    });
  },

  updatePresence: (authorId, data) => {
    set(state => {
      const prev = state.presence[authorId];
      // Publish-time recency (data.lastSeen = envelope.ts) — never let a
      // replayed older heartbeat roll a fresher sighting backwards.
      const lastSeen = data.lastSeen ?? Date.now();
      if (prev && prev.lastSeen > lastSeen) return {};
      return {
        presence: {
          ...state.presence,
          [authorId]: {
            ...prev,
            ...data,
            lastSeen
          }
        }
      };
    });
  },

  addPrivateConversation: (partnerId, topic, key) => {
    set(state => ({
      privateConversations: {
        ...state.privateConversations,
        [partnerId]: { topic, key, messages: [] }
      }
    }));
  },

  addPrivateMessage: (partnerId, msg) => {
    set(state => {
      const conv = state.privateConversations[partnerId];
      if (!conv) return {};
      return {
        privateConversations: {
          ...state.privateConversations,
          [partnerId]: {
            ...conv,
            messages: [...conv.messages, msg]
          }
        }
      };
    });
  }
}));
