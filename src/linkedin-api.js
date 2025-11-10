/**
 * @file LinkedIn API client wrapper
 * Handles all HTTP communication with LinkedIn REST API
 */

const https = require('https');
const { URLSearchParams } = require('url');

/**
 * Make an HTTPS request to LinkedIn API
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method
 * @param {string} options.path - API path
 * @param {Object} [options.headers] - HTTP headers
 * @param {Object|string} [options.body] - Request body
 * @returns {Promise<Object>} Response data and headers
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const { method, path, headers = {}, body } = options;

    const requestOptions = {
      hostname: 'api.linkedin.com',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const response = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? (data.trim() ? JSON.parse(data) : {}) : {}
        };

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(response);
        } else {
          const error = new Error(`LinkedIn API error: ${res.statusCode}`);
          error.response = response;
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyString);
    }

    req.end();
  });
}

/**
 * Make an OAuth token request
 * @param {string} hostname - OAuth hostname
 * @param {string} path - OAuth path
 * @param {Object} params - URL-encoded parameters
 * @returns {Promise<Object>} Token response
 */
function makeOAuthRequest(hostname, path, params) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(params).toString();

    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const response = JSON.parse(data);

        if (res.statusCode === 200) {
          resolve(response);
        } else {
          const error = new Error(response.error_description || 'OAuth error');
          error.response = response;
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * LinkedIn API client
 */
class LinkedInAPI {
  /**
   * @param {Object} config
   * @param {string} config.accessToken - OAuth access token
   * @param {string} config.apiVersion - API version (YYYYMM format)
   * @param {string} config.personId - User's person URN
   */
  constructor(config) {
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion;
    this.personId = config.personId;
  }

  /**
   * Create a LinkedIn post
   * @param {Object} postData - Post data
   * @returns {Promise<{postUrn: string, statusCode: number}>}
   */
  async createPost(postData) {
    const response = await makeRequest({
      method: 'POST',
      path: '/rest/posts',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: postData
    });

    return {
      postUrn: response.headers['x-restli-id'],
      statusCode: response.statusCode
    };
  }

  /**
   * Get user's posts
   * @param {Object} params
   * @param {number} params.limit - Max posts to retrieve
   * @param {number} params.offset - Pagination offset
   * @returns {Promise<Object>} Posts list
   */
  async getPosts({ limit, offset }) {
    const authorUrn = encodeURIComponent(`urn:li:person:${this.personId}`);
    const path = `/rest/posts?author=${authorUrn}&q=author&start=${offset}&count=${limit}`;

    const response = await makeRequest({
      method: 'GET',
      path,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    return response.body;
  }

  /**
   * Delete a post
   * @param {string} postUrn - Post URN to delete
   * @returns {Promise<{statusCode: number}>}
   */
  async deletePost(postUrn) {
    const encodedUrn = encodeURIComponent(postUrn);

    const response = await makeRequest({
      method: 'DELETE',
      path: `/rest/posts/${encodedUrn}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    return {
      statusCode: response.statusCode
    };
  }

  /**
   * Get user info from userinfo endpoint
   * @returns {Promise<Object>} User information
   */
  async getUserInfo() {
    const response = await makeRequest({
      method: 'GET',
      path: '/v2/userinfo',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    return response.body;
  }

  /**
   * Exchange authorization code for access token
   * @param {Object} params
   * @param {string} params.code - Authorization code
   * @param {string} params.clientId - OAuth client ID
   * @param {string} params.clientSecret - OAuth client secret
   * @param {string} params.redirectUri - OAuth redirect URI
   * @returns {Promise<Object>} Token response
   */
  static async exchangeAuthCode({ code, clientId, clientSecret, redirectUri }) {
    return makeOAuthRequest('www.linkedin.com', '/oauth/v2/accessToken', {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    });
  }
}

module.exports = LinkedInAPI;
