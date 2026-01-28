/**
 * Local callback server for OAuth flow
 *
 * Starts a temporary HTTP server to receive OAuth callbacks,
 * avoiding the need for manual URL copy-paste.
 */

const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const PORT_RANGE_START = 8880;
const PORT_RANGE_END = 8899;
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Find an available port in the specified range
 * @returns {Promise<number>}
 */
async function findAvailablePort() {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available port in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
}

/**
 * Check if a port is available
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Generate a cryptographic nonce for CSRF protection
 * @returns {string}
 */
function generateNonce() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * HTML page shown on successful OAuth completion
 */
function successPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>LinkedIn Connected</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f2ef; }
    .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #0a66c2; margin-bottom: 16px; }
    p { color: #666; }
    .checkmark { font-size: 64px; margin-bottom: 16px; color: #0a66c2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">&#10003;</div>
    <h1>LinkedIn Connected!</h1>
    <p>Your credentials have been securely stored.</p>
    <p>You can close this window and return to Claude.</p>
  </div>
</body>
</html>`;
}

/**
 * HTML page shown on OAuth error
 * @param {string} error
 */
function errorPage(error) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Connection Failed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f2ef; }
    .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #cc0000; margin-bottom: 16px; }
    p { color: #666; }
    .error { font-size: 64px; margin-bottom: 16px; color: #cc0000; }
    .details { background: #f5f5f5; padding: 12px; border-radius: 4px; font-family: monospace; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error">&#10007;</div>
    <h1>Connection Failed</h1>
    <p>There was a problem connecting your LinkedIn account.</p>
    <div class="details">${error}</div>
    <p>Please try again or check the Claude logs for details.</p>
  </div>
</body>
</html>`;
}

/**
 * Start a local callback server for OAuth
 *
 * @returns {Promise<{port: number, nonce: string, waitForCallback: () => Promise<Object>}>}
 */
async function startCallbackServer() {
  const port = await findAvailablePort();
  const nonce = generateNonce();

  let server;
  let timeoutId;

  const waitForCallback = () => {
    return new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);

        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        // Extract parameters from query string
        const receivedNonce = url.searchParams.get('nonce');
        const accessToken = url.searchParams.get('access_token');
        const personId = url.searchParams.get('person_id');
        const refreshToken = url.searchParams.get('refresh_token');
        const expiresIn = url.searchParams.get('expires_in');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // Validate nonce for CSRF protection
        if (receivedNonce !== nonce) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(errorPage('Invalid security token. Please try again.'));
          cleanup();
          reject(new Error('Nonce mismatch - possible CSRF attack'));
          return;
        }

        // Handle errors from OAuth relay
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(errorPage(errorDescription || error));
          cleanup();
          reject(new Error(`OAuth error: ${errorDescription || error}`));
          return;
        }

        // Validate required fields
        if (!accessToken || !personId) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(errorPage('Missing access token or person ID'));
          cleanup();
          reject(new Error('Missing required OAuth credentials'));
          return;
        }

        // Success
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(successPage());

        const credentials = {
          accessToken,
          personId,
          refreshToken: refreshToken || null,
          expiresAt: expiresIn ? Date.now() + parseInt(expiresIn, 10) * 1000 : null,
        };

        cleanup();
        resolve(credentials);
      });

      server.listen(port, '127.0.0.1', () => {
        // Server is ready
      });

      server.on('error', (err) => {
        cleanup();
        reject(err);
      });

      // Timeout after 5 minutes
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('OAuth callback timeout - no response received within 5 minutes'));
      }, CALLBACK_TIMEOUT_MS);
    });
  };

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (server) {
      server.close();
      server = null;
    }
  };

  return { port, nonce, waitForCallback };
}

module.exports = {
  startCallbackServer,
  generateNonce,
  findAvailablePort
};
