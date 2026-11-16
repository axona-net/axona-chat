import CryptoJS from 'crypto-js';

/**
 * CryptoService holds the symmetric helpers for invite-link channels (the key
 * travels in the link). There is NO encrypt-to-author here: the earlier one
 * keyed on the recipient's public Author ID and was removed in 0.109.0.
 */
class CryptoService {
  /**
   * Generates a random topic name for an invite-link channel.
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
