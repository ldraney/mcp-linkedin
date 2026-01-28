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
    this.apiVersion = config.apiVersion || '202510'; // YYYYMM format
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
   * Update a post (partial update)
   * @param {string} postUrn - Post URN to update
   * @param {Object} updateData - Fields to update
   * @param {string} [updateData.commentary] - New post text
   * @param {string} [updateData.contentCallToActionLabel] - New CTA label
   * @param {string} [updateData.contentLandingPage] - New landing page URL
   * @returns {Promise<{statusCode: number}>}
   */
  async updatePost(postUrn, updateData) {
    const encodedUrn = encodeURIComponent(postUrn);

    // Build the $set object with only provided fields
    const $set = {};
    if (updateData.commentary !== undefined) {
      $set.commentary = updateData.commentary;
    }
    if (updateData.contentCallToActionLabel !== undefined) {
      $set.contentCallToActionLabel = updateData.contentCallToActionLabel;
    }
    if (updateData.contentLandingPage !== undefined) {
      $set.contentLandingPage = updateData.contentLandingPage;
    }

    const response = await makeRequest({
      method: 'POST',
      path: `/rest/posts/${encodedUrn}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'X-RestLi-Method': 'PARTIAL_UPDATE'
      },
      body: {
        patch: { $set }
      }
    });

    return {
      statusCode: response.statusCode
    };
  }

  /**
   * Initialize image upload to get upload URL
   * @returns {Promise<{uploadUrl: string, imageUrn: string}>}
   */
  async initializeImageUpload() {
    const response = await makeRequest({
      method: 'POST',
      path: '/rest/images?action=initializeUpload',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: {
        initializeUploadRequest: {
          owner: `urn:li:person:${this.personId}`
        }
      }
    });

    return {
      uploadUrl: response.body.value.uploadUrl,
      imageUrn: response.body.value.image
    };
  }

  /**
   * Upload image binary to LinkedIn
   * @param {string} uploadUrl - URL from initializeImageUpload
   * @param {Buffer} imageBuffer - Image binary data
   * @param {string} contentType - MIME type (image/png, image/jpeg, image/gif)
   * @returns {Promise<{statusCode: number}>}
   */
  async uploadImageBinary(uploadUrl, imageBuffer, contentType) {
    return new Promise((resolve, reject) => {
      const url = new URL(uploadUrl);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': contentType,
          'Content-Length': imageBuffer.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode });
          } else {
            const error = new Error(`Image upload failed: ${res.statusCode}`);
            error.response = { statusCode: res.statusCode, body: data };
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(imageBuffer);
      req.end();
    });
  }

  /**
   * Refresh access token using refresh token
   * @param {Object} params
   * @param {string} params.refreshToken - Refresh token
   * @param {string} params.clientId - OAuth client ID
   * @param {string} params.clientSecret - OAuth client secret
   * @returns {Promise<Object>} New token response
   */
  static async refreshAccessToken({ refreshToken, clientId, clientSecret }) {
    return makeOAuthRequest('www.linkedin.com', '/oauth/v2/accessToken', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    });
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

  /**
   * Add a comment to a post
   * @param {string} postUrn - Post URN to comment on
   * @param {string} text - Comment text
   * @returns {Promise<{commentUrn: string, statusCode: number}>}
   */
  async addComment(postUrn, text) {
    const encodedUrn = encodeURIComponent(postUrn);

    const response = await makeRequest({
      method: 'POST',
      path: `/rest/socialActions/${encodedUrn}/comments`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: {
        actor: `urn:li:person:${this.personId}`,
        message: {
          text
        }
      }
    });

    return {
      commentUrn: response.headers['x-restli-id'],
      statusCode: response.statusCode
    };
  }

  /**
   * Add a reaction to a post
   * @param {string} postUrn - Post URN to react to
   * @param {string} reactionType - Type of reaction (LIKE, PRAISE, EMPATHY, INTEREST, APPRECIATION, ENTERTAINMENT)
   * @returns {Promise<{statusCode: number}>}
   */
  async addReaction(postUrn, reactionType) {
    const actorUrn = encodeURIComponent(`urn:li:person:${this.personId}`);

    const response = await makeRequest({
      method: 'POST',
      path: `/rest/reactions?actor=${actorUrn}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: {
        root: postUrn,
        reactionType
      }
    });

    return {
      statusCode: response.statusCode
    };
  }

  /**
   * Initialize document upload to get upload URL
   * @returns {Promise<{uploadUrl: string, documentUrn: string}>}
   */
  async initializeDocumentUpload() {
    const response = await makeRequest({
      method: 'POST',
      path: '/rest/documents?action=initializeUpload',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: {
        initializeUploadRequest: {
          owner: `urn:li:person:${this.personId}`
        }
      }
    });

    return {
      uploadUrl: response.body.value.uploadUrl,
      documentUrn: response.body.value.document
    };
  }

  /**
   * Upload document binary to LinkedIn
   * @param {string} uploadUrl - URL from initializeDocumentUpload
   * @param {Buffer} documentBuffer - Document binary data
   * @param {string} contentType - MIME type
   * @returns {Promise<{statusCode: number}>}
   */
  async uploadDocumentBinary(uploadUrl, documentBuffer, contentType) {
    return new Promise((resolve, reject) => {
      const url = new URL(uploadUrl);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': contentType,
          'Content-Length': documentBuffer.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode });
          } else {
            const error = new Error(`Document upload failed: ${res.statusCode}`);
            error.response = { statusCode: res.statusCode, body: data };
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(documentBuffer);
      req.end();
    });
  }

  /**
   * Initialize video upload to get upload URL and video URN
   * @param {number} fileSizeBytes - Size of video file in bytes
   * @returns {Promise<{uploadUrl: string, videoUrn: string}>}
   */
  async initializeVideoUpload(fileSizeBytes) {
    const response = await makeRequest({
      method: 'POST',
      path: '/rest/videos?action=initializeUpload',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: {
        initializeUploadRequest: {
          owner: `urn:li:person:${this.personId}`,
          fileSizeBytes,
          uploadCaptions: false,
          uploadThumbnail: false
        }
      }
    });

    return {
      uploadUrl: response.body.value.uploadInstructions[0].uploadUrl,
      videoUrn: response.body.value.video
    };
  }

  /**
   * Upload video binary to LinkedIn
   * @param {string} uploadUrl - URL from initializeVideoUpload
   * @param {Buffer} videoBuffer - Video binary data
   * @param {string} contentType - MIME type
   * @returns {Promise<{statusCode: number, etag: string}>}
   */
  async uploadVideoBinary(uploadUrl, videoBuffer, contentType) {
    return new Promise((resolve, reject) => {
      const url = new URL(uploadUrl);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': contentType,
          'Content-Length': videoBuffer.length
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              etag: res.headers['etag'] || ''
            });
          } else {
            const error = new Error(`Video upload failed: ${res.statusCode}`);
            error.response = { statusCode: res.statusCode, body: data };
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(videoBuffer);
      req.end();
    });
  }

  /**
   * Finalize video upload after binary upload is complete
   * @param {string} videoUrn - Video URN from initializeVideoUpload
   * @param {string} uploadUrl - Upload URL used
   * @param {string} etag - ETag from upload response
   * @returns {Promise<{statusCode: number}>}
   */
  async finalizeVideoUpload(videoUrn, uploadUrl, etag) {
    const response = await makeRequest({
      method: 'POST',
      path: '/rest/videos?action=finalizeUpload',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: {
        finalizeUploadRequest: {
          video: videoUrn,
          uploadToken: '',
          uploadedPartIds: [etag]
        }
      }
    });

    return {
      statusCode: response.statusCode
    };
  }

  /**
   * Initialize multi-image upload for batch image upload
   * @param {number} imageCount - Number of images to upload
   * @returns {Promise<Array<{uploadUrl: string, imageUrn: string}>>}
   */
  async initializeMultiImageUpload(imageCount) {
    const results = [];

    for (let i = 0; i < imageCount; i++) {
      const response = await makeRequest({
        method: 'POST',
        path: '/rest/images?action=initializeUpload',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'LinkedIn-Version': this.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: {
          initializeUploadRequest: {
            owner: `urn:li:person:${this.personId}`
          }
        }
      });

      results.push({
        uploadUrl: response.body.value.uploadUrl,
        imageUrn: response.body.value.image
      });
    }

    return results;
  }
}

module.exports = LinkedInAPI;
