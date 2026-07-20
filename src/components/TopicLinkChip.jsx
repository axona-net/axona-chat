import React from 'react';
import { useChatStore } from '../stores/useChatStore.js';
import AxonaChatClient from '../services/AxonaChatClient.js';
import { parseTopicLink, topicLabel } from '../services/topicLink.js';

// Renders an Axona topic link inline as a distinct chip (not a plain hyperlink),
// so it's unmistakable that clicking it joins a conversation rather than leaving
// the app. Clicking adds the topic to the user's list and opens it — the same
// join path the Discovery ticker uses (mirror of TopicTicker.handleOpenAd).
const TopicLinkChip = ({ href, children }) => {
  const addTopic = useChatStore((s) => s.addTopic);
  const setActiveTopic = useChatStore((s) => s.setActiveTopic);

  const descriptor = parseTopicLink(href);
  // Not a decodable topic link → fall back to a normal safe anchor.
  if (!descriptor) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  }

  const join = (e) => {
    e.preventDefault();
    const topic = {
      region: descriptor.region,
      name: descriptor.name,
      owner: descriptor.owner || undefined,
      write: descriptor.write || (descriptor.owner ? 'owner' : 'open'),
    };
    addTopic(topic);
    setActiveTopic(topic);
    try { AxonaChatClient.reconcileSubscriptions(); } catch { /* client may not be ready yet */ }
  };

  return (
    <a
      href={href}
      onClick={join}
      className="topic-link-chip"
      title={`Open the “${topicLabel(descriptor)}” topic — adds it to your list and switches to it`}
    >
      <span className="topic-link-chip__hash" aria-hidden="true">#</span>
      <span className="topic-link-chip__name">{descriptor.name}</span>
      <span className="topic-link-chip__tag">topic</span>
    </a>
  );
};

export default TopicLinkChip;
