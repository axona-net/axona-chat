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

  it('should simulate asymmetric encryption and decryption to an author ID', () => {
    const plaintext = 'Secret private message payload';
    const aliceId = 'alice-author-id-123';
    const bobId = 'bob-author-id-456';

    const envelope = CryptoService.encryptToAuthor(plaintext, bobId, aliceId);
    expect(envelope).toBeTypeOf('string');

    // Bob (recipient) can decrypt it
    const bobDecrypted = CryptoService.decryptAsRecipient(envelope, bobId);
    expect(bobDecrypted).toBe(plaintext);

    // Alice (sender) cannot decrypt it (only Bob can)
    const aliceDecrypted = CryptoService.decryptAsRecipient(envelope, aliceId);
    expect(aliceDecrypted).toBeNull();

    // Random person cannot decrypt it
    const randomDecrypted = CryptoService.decryptAsRecipient(envelope, 'random-person-id');
    expect(randomDecrypted).toBeNull();
  });
});
