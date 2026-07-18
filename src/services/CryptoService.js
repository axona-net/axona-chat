import CryptoJS from 'crypto-js';

/**
 * CryptoService manages asymmetric and symmetric encryption for private messages
 * and private continuation channels.
 */
class CryptoService {
  /**
   * Generates a random topic descriptor name for a private continuation.
   */
  generatePrivateTopic() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `private-topic-${hex}`;
  }

  /**
   * Derives a symmetric session key from a random seed.
   */
  deriveSessionKey(seed) {
    return CryptoJS.SHA256(seed).toString(CryptoJS.enc.Hex);
  }

  /**
   * Simulates asymmetric encryption of a session key to a recipient's Author ID.
   * In a real app, this uses ECIES or X25519 ECDH. Here we simulate it
   * by encrypting using a key that can be decrypted by the recipient.
   */
  encryptToAuthor(plaintext, recipientAuthorId, senderAuthorId) {
    // Generate a random key for symmetric encryption of the plaintext
    const sessionKey = CryptoJS.lib.WordArray.random(16).toString();
    const encryptedPayload = CryptoJS.AES.encrypt(plaintext, sessionKey).toString();

    // To simulate asymmetric encryption of the sessionKey to the recipientAuthorId:
    // We create an envelope that stores the recipientAuthorId and the encrypted key.
    // In our client, only the handle with the matching authorId can decrypt it.
    const keyEnvelope = {
      recipient: recipientAuthorId,
      sender: senderAuthorId,
      // For simulation: we XOR the sessionKey with a key derived from recipientAuthorId
      // In a real app, this would be encrypted with Bob's public key.
      encryptedKey: CryptoJS.AES.encrypt(sessionKey, recipientAuthorId).toString()
    };

    return JSON.stringify({
      keyEnvelope,
      encryptedPayload
    });
  }

  /**
   * Decrypts an envelope meant for the recipient.
   * Returns plaintext if successful, or null if the reader is not the intended recipient.
   */
  decryptAsRecipient(encryptedString, recipientAuthorId) {
    try {
      const { keyEnvelope, encryptedPayload } = JSON.parse(encryptedString);
      if (!keyEnvelope || !encryptedPayload) return null;

      // Only the recipient can decrypt
      if (keyEnvelope.recipient !== recipientAuthorId) {
        return null; // Not the recipient
      }

      // Decrypt the session key using the recipient's authorId
      const keyBytes = CryptoJS.AES.decrypt(keyEnvelope.encryptedKey, recipientAuthorId);
      const sessionKey = keyBytes.toString(CryptoJS.enc.Utf8);
      if (!sessionKey) return null;

      // Decrypt the actual payload
      const payloadBytes = CryptoJS.AES.decrypt(encryptedPayload, sessionKey);
      return payloadBytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      console.warn('Failed to decrypt as recipient:', e);
      return null;
    }
  }

  /**
   * Symmetrically encrypts a message for a private channel.
   */
  encryptSymmetric(plaintext, secretKey) {
    return CryptoJS.AES.encrypt(plaintext, secretKey).toString();
  }

  /**
   * Symmetrically decrypts a message for a private channel.
   */
  decryptSymmetric(ciphertext, secretKey) {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      return plaintext || null;
    } catch {
      return null;
    }
  }
}

export default new CryptoService();
