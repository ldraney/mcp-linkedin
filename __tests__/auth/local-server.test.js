/**
 * @file Tests for local callback server
 * Tests the OAuth callback server functionality
 */

const http = require('http');
const { URL } = require('url');

// We need to test the actual module, not mock it
const {
  startCallbackServer,
  generateNonce,
  findAvailablePort
} = require('../../src/auth/local-server');

describe('Local Callback Server', () => {
  describe('generateNonce', () => {
    it('should generate a base64url-encoded string', () => {
      const nonce = generateNonce();

      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(20);
      // Base64url should not contain + or /
      expect(nonce).not.toMatch(/[+\/]/);
    });

    it('should generate unique nonces', () => {
      const nonces = new Set();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(100);
    });
  });

  describe('findAvailablePort', () => {
    it('should find a port in the expected range', async () => {
      const port = await findAvailablePort();

      expect(port).toBeGreaterThanOrEqual(8880);
      expect(port).toBeLessThanOrEqual(8899);
    });
  });

  describe('startCallbackServer', () => {
    it('should return port, nonce, and waitForCallback function', async () => {
      const serverInfo = await startCallbackServer();

      expect(serverInfo).toHaveProperty('port');
      expect(serverInfo).toHaveProperty('nonce');
      expect(serverInfo).toHaveProperty('waitForCallback');

      expect(typeof serverInfo.port).toBe('number');
      expect(typeof serverInfo.nonce).toBe('string');
      expect(typeof serverInfo.waitForCallback).toBe('function');

      expect(serverInfo.port).toBeGreaterThanOrEqual(8880);
      expect(serverInfo.port).toBeLessThanOrEqual(8899);

      // Don't call waitForCallback - that would start the server listening
      // Just verify the shape is correct
    });

    it('should receive credentials on successful callback', async () => {
      const { port, nonce, waitForCallback } = await startCallbackServer();

      // Start waiting for callback
      const callbackPromise = waitForCallback();

      // Simulate OAuth relay callback
      const callbackUrl = `http://127.0.0.1:${port}/callback?` +
        `nonce=${nonce}&` +
        `access_token=test-access-token&` +
        `person_id=test-person-id&` +
        `expires_in=5184000`;

      // Make HTTP request to callback endpoint
      await new Promise((resolve, reject) => {
        const url = new URL(callbackUrl);
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: url.pathname + url.search,
          method: 'GET'
        }, (res) => {
          expect(res.statusCode).toBe(200);
          resolve();
        });
        req.on('error', reject);
        req.end();
      });

      // Wait for credentials
      const credentials = await callbackPromise;

      expect(credentials).toEqual({
        accessToken: 'test-access-token',
        personId: 'test-person-id',
        refreshToken: null,
        expiresAt: expect.any(Number)
      });
    });

    it('should reject on nonce mismatch', async () => {
      const { port, waitForCallback } = await startCallbackServer();

      // Start waiting FIRST and attach catch handler immediately
      const callbackPromise = waitForCallback();
      let rejection = null;
      callbackPromise.catch(err => { rejection = err; });

      // Callback with wrong nonce
      const callbackUrl = `http://127.0.0.1:${port}/callback?` +
        `nonce=wrong-nonce&` +
        `access_token=test-token&` +
        `person_id=test-person`;

      // Make the request
      await new Promise((resolve) => {
        const url = new URL(callbackUrl);
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: url.pathname + url.search,
          method: 'GET'
        }, (res) => {
          expect(res.statusCode).toBe(400);
          resolve();
        });
        req.on('error', resolve);
        req.end();
      });

      // Wait a tick for the rejection to be captured
      await new Promise(r => setTimeout(r, 10));

      expect(rejection).not.toBeNull();
      expect(rejection.message).toContain('Nonce mismatch');
    });

    it('should reject on OAuth error', async () => {
      const { port, nonce, waitForCallback } = await startCallbackServer();

      // Start waiting FIRST and attach catch handler immediately
      const callbackPromise = waitForCallback();
      let rejection = null;
      callbackPromise.catch(err => { rejection = err; });

      // Callback with error
      const callbackUrl = `http://127.0.0.1:${port}/callback?` +
        `nonce=${nonce}&` +
        `error=access_denied&` +
        `error_description=User+denied+access`;

      await new Promise((resolve) => {
        const url = new URL(callbackUrl);
        const req = http.request({
          hostname: '127.0.0.1',
          port: port,
          path: url.pathname + url.search,
          method: 'GET'
        }, (res) => {
          expect(res.statusCode).toBe(400);
          resolve();
        });
        req.on('error', resolve);
        req.end();
      });

      // Wait a tick for the rejection to be captured
      await new Promise(r => setTimeout(r, 10));

      expect(rejection).not.toBeNull();
      expect(rejection.message).toContain('OAuth error');
    });
  });
});
