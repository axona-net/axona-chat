import { describe, it, expect } from 'vitest';
import CryptoService from '../CryptoService.js';

describe('CryptoService', () => {
  it('should generate a private topic name', () => {
    const topic = CryptoService.generatePrivateTopic();
    expect(topic).toBeTypeOf('string');
    expect(topic.startsWith('private-topic-')).toBe(true);
    expect(topic.length).toBeGreaterThan(20);
  });

  it('should derive a session key from a seed', () => {
    const seed = 'test-seed-123';
    const key1 = CryptoService.deriveSessionKey(seed);
    const key2 = CryptoService.deriveSessionKey(seed);
    const key3 = CryptoService.deriveSessionKey('another-seed');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toBeTypeOf('string');
  });

  it('should encrypt and decrypt messages symmetrically', () => {
    const message = 'Hello P2P world!';
    const key = 'secret-session-key';

    const ciphertext = CryptoService.encryptSymmetric(message, key);
    expect(ciphertext).not.toBe(message);

    const decrypted = CryptoService.decryptSymmetric(ciphertext, key);
    expect(decrypted).toBe(message);

    // Wrong key fails
    const badDecrypted = CryptoService.decryptSymmetric(ciphertext, 'wrong-key');
    expect(badDecrypted).toBeNull();
  });

  it('has no encrypt-to-author: Private Reply was removed in 0.109.0', () => {
    // The removed version keyed on the recipient's PUBLIC Author ID, so any
    // reader of the topic could open it. It must not come back in that shape.
    expect(CryptoService.encryptToAuthor).toBeUndefined();
    expect(CryptoService.decryptAsRecipient).toBeUndefined();
  });
});
