const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `https://${process.env.FLY_APP_NAME}.fly.dev/auth/callback`;
const LOCALHOST_CALLBACK = 'http://localhost:8888/callback';

// Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>LinkedIn MCP Auth</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 600px;
          margin: 80px auto;
          padding: 20px;
          background: linear-gradient(135deg, #0077b5 0%, #004182 100%);
          min-height: 100vh;
          box-sizing: border-box;
        }
        .card {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 { color: #0077b5; margin: 0 0 10px 0; }
        p { color: #666; line-height: 1.6; }
        code { background: #f4f4f4; padding: 2px 8px; border-radius: 4px; font-size: 14px; }
        .logo { font-size: 48px; margin-bottom: 20px; }
        a { color: #0077b5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">in</div>
        <h1>LinkedIn MCP Auth</h1>
        <p>This service handles OAuth authentication for <a href="https://github.com/intelligent-staffing-systems/mcp-linkedin">mcp-linkedin</a>.</p>
        <p>To authenticate, use the LinkedIn MCP tools in Claude Desktop:</p>
        <pre><code>linkedin_get_auth_url</code></pre>
        <p style="margin-top: 20px; font-size: 14px; color: #999;">
          <a href="/health">Health check</a>
        </p>
      </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mcp-linkedin-oauth-relay', timestamp: new Date().toISOString() });
});

// Step 1: Redirect user to LinkedIn OAuth
app.get('/auth/linkedin', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'LINKEDIN_CLIENT_ID not configured' });
  }

  const scope = 'openid profile email w_member_social';
  const state = Math.random().toString(36).substring(7);

  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// Step 2: Handle callback from LinkedIn, exchange code for token
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return redirectToLocalhost(res, { error, error_description });
  }

  if (!code) {
    return redirectToLocalhost(res, { error: 'missing_code', error_description: 'No authorization code received' });
  }

  try {
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);

    // Get user info to get person ID
    const userInfo = await getUserInfo(tokenData.access_token);

    // Redirect to localhost with token and person ID
    redirectToLocalhost(res, {
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      person_id: userInfo.sub,
      name: userInfo.name
    });
  } catch (err) {
    console.error('OAuth error:', err);
    redirectToLocalhost(res, { error: 'token_exchange_failed', error_description: err.message });
  }
});

function redirectToLocalhost(res, params) {
  const url = new URL(LOCALHOST_CALLBACK);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  res.redirect(url.toString());
}

function exchangeCodeForToken(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI
    }).toString();

    const options = {
      hostname: 'www.linkedin.com',
      path: '/oauth/v2/accessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error_description || parsed.error));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('Failed to parse token response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getUserInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.linkedin.com',
      path: '/v2/userinfo',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse user info'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

app.listen(PORT, () => {
  console.log(`OAuth relay running on port ${PORT}`);
  console.log(`Auth URL: /auth/linkedin`);
  console.log(`Callback: ${REDIRECT_URI}`);
});
