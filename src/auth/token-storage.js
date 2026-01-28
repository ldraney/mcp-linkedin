/**
 * Token storage module using OS keychain via @napi-rs/keyring
 *
 * Stores OAuth credentials securely in:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service (requires libsecret)
 */

const { Entry } = require('@napi-rs/keyring');

const SERVICE_NAME = 'mcp-linkedin';
const ACCOUNT_NAME = 'oauth-credentials';

/**
 * Store OAuth credentials in OS keychain
 * @param {Object} credentials
 * @param {string} credentials.accessToken - LinkedIn access token
 * @param {string} credentials.personId - LinkedIn person URN ID
 * @param {string} [credentials.refreshToken] - Optional refresh token
 * @param {number} [credentials.expiresAt] - Token expiration timestamp
 */
function storeCredentials(credentials) {
  const entry = new Entry(SERVICE_NAME, ACCOUNT_NAME);
  entry.setPassword(JSON.stringify(credentials));
}

/**
 * Retrieve OAuth credentials from OS keychain
 * @returns {Object|null} Credentials object or null if not found
 */
function getCredentials() {
  const entry = new Entry(SERVICE_NAME, ACCOUNT_NAME);
  try {
    const data = entry.getPassword();
    return data ? JSON.parse(data) : null;
  } catch (error) {
    // No credentials stored or access denied
    return null;
  }
}

/**
 * Delete OAuth credentials from OS keychain
 * @returns {boolean} True if deleted, false if not found
 */
function deleteCredentials() {
  const entry = new Entry(SERVICE_NAME, ACCOUNT_NAME);
  try {
    entry.deletePassword();
    return true;
  } catch (error) {
    // Credential not found - that's fine
    return false;
  }
}

/**
 * Check if credentials exist in keychain
 * @returns {boolean}
 */
function hasCredentials() {
  return getCredentials() !== null;
}

module.exports = {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  hasCredentials
};
