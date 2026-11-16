import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import client from '../AxonaChatClient.js';
import { useChatStore } from '../../stores/useChatStore.js';

const topic = { region: 'eagle', name: 'publish-options-test', write: 'open' };
const author = { publicKey: 'test-author' };
const refused = [
  { label: 'recipient', options: { encryptToRecipient: 'recipient' } },
  { label: 'empty recipient', options: { encryptToRecipient: '' } },
  { label: 'null recipient', options: { encryptToRecipient: null } },
  { label: 'undefined recipient', options: { encryptToRecipient: undefined } },
  { label: 'false recipient', options: { encryptToRecipient: false } },
  { label: 'inherited recipient', options: Object.create({ encryptToRecipient: 'recipient' }) },
  { label: 'continuation topic', options: { privateTopic: 'old-handoff' } },
  { label: 'continuation key', options: { privateKey: 'old-handoff-key' } },
];
let peer;
beforeEach(() => {
  peer = { pub: vi.fn(async () => 'sent'), peers: () => [{}] };
  client.peer = peer;
  useChatStore.setState({
    currentHandle: { name: 'Test', authorId: 'author', authorRef: 'test' },
    currentDeclaration: 'human',
    pendingSends: { existing: { payload: { v: 1, text: 'earlier public send' } } },
  });
  vi.spyOn(client, 'getActiveAuthor').mockResolvedValue(author);
});
afterEach(() => { client.peer = null; vi.restoreAllMocks(); });

describe('publish rejects removed private-reply options', () => {
  it.each(refused)('refuses $label before signing, publishing or changing pending state', async ({ options }) => {
    const pending = useChatStore.getState().pendingSends;
    await expect(client.publish(topic, 'synthetic sensitive text', options))
      .rejects.toThrow('Private Reply is unavailable. No message was sent.');
    expect(client.getActiveAuthor).not.toHaveBeenCalled();
    expect(peer.pub).not.toHaveBeenCalled();
    expect(useChatStore.getState().pendingSends).toBe(pending);
  });

  it('publishes an ordinary signed public message with default options', async () => {
    await expect(client.publish(topic, 'public text')).resolves.toBe('sent');
    expect(peer.pub).toHaveBeenCalledWith(topic,
      expect.objectContaining({ text: 'public text', handle: 'Test', authorClass: 'human' }),
      { signWith: author });
    expect(useChatStore.getState().pendingSends.sent).toBeTruthy();
  });

  it('preserves a normal public reply target', async () => {
    await client.publish(topic, 'public reply', { replyTo: 'parent' });
    expect(peer.pub).toHaveBeenCalledWith(topic,
      expect.objectContaining({ text: 'public reply', replyTo: 'parent' }), { signWith: author });
  });

  it('allows an existing invite-key descriptor, which is separate from removed private options', async () => {
    const invite = { ...topic, privateKey: 'synthetic-invite-key' };
    await expect(client.publish(invite, 'synthetic channel text', { replyTo: 'parent' })).resolves.toBe('sent');
    expect(peer.pub).toHaveBeenCalledWith(invite,
      expect.objectContaining({ kind: 'encrypted-channel', ciphertext: expect.any(String), replyTo: 'parent' }),
      { signWith: author });
    expect(peer.pub.mock.calls[0][1]).not.toHaveProperty('text');
  });
});
