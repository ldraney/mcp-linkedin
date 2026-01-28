/**
 * @file LinkedIn MCP Tools Implementation
 * All 7 core tools for LinkedIn posting and authentication
 */

require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const LinkedInAPI = require('./linkedin-api');
const schemas = require('./schemas');
const { getDatabase } = require('./database');
const { startCallbackServer } = require('./auth/local-server');
const { storeCredentials, getCredentials } = require('./auth/token-storage');

/**
 * Mask a token for safe display (shows first 4 and last 4 chars)
 * @param {string} token - Token to mask
 * @returns {string} Masked token like "AQWd...5czd"
 */
function maskToken(token) {
  if (!token || token.length < 12) return '****';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * Get LinkedIn API client instance
 * @returns {LinkedInAPI}
 */
function getAPIClient() {
  return new LinkedInAPI({
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    apiVersion: process.env.LINKEDIN_API_VERSION,
    personId: process.env.LINKEDIN_PERSON_ID
  });
}

/**
 * Create a simple text post on LinkedIn
 * @param {import('./types').CreatePostInput} input
 * @returns {Promise<import('./types').CreatePostOutput>}
 */
async function linkedin_create_post(input) {
  // Validate input
  const validated = schemas.CreatePostInputSchema.parse(input);

  const api = getAPIClient();

  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary,
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    lifecycleState: 'PUBLISHED'
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    message: 'Post created successfully',
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`
  };
}

/**
 * Create a post with a link (article preview)
 * @param {import('./types').CreatePostWithLinkInput} input
 * @returns {Promise<import('./types').CreatePostOutput>}
 */
async function linkedin_create_post_with_link(input) {
  // Validate input
  const validated = schemas.CreatePostWithLinkInputSchema.parse(input);

  const api = getAPIClient();

  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary,
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    content: {
      article: {
        source: validated.url,
        title: validated.title || validated.url,
        ...(validated.description && { description: validated.description })
      }
    },
    lifecycleState: 'PUBLISHED'
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    message: 'Post with link created successfully',
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`
  };
}

/**
 * Retrieve user's recent posts
 * @param {import('./types').GetPostsInput} input
 * @returns {Promise<import('./types').GetPostsOutput>}
 */
async function linkedin_get_my_posts(input = {}) {
  // Validate input with defaults
  const validated = schemas.GetPostsInputSchema.parse(input);

  const api = getAPIClient();
  const result = await api.getPosts({
    limit: validated.limit,
    offset: validated.offset
  });

  // Transform API response to our output format
  const posts = result.elements || [];
  const total = result.paging?.total || 0;

  return {
    posts: posts.map(post => ({
      id: post.id,
      author: post.author,
      commentary: post.commentary || '',
      visibility: post.visibility,
      createdAt: post.created?.time ? new Date(post.created.time).toISOString() : new Date().toISOString(),
      lifecycleState: post.lifecycleState || 'PUBLISHED'
    })),
    count: posts.length,
    offset: validated.offset,
    hasMore: validated.offset + posts.length < total
  };
}

/**
 * Delete a LinkedIn post
 * @param {import('./types').DeletePostInput} input
 * @returns {Promise<import('./types').DeletePostOutput>}
 */
async function linkedin_delete_post(input) {
  // Validate input
  const validated = schemas.DeletePostInputSchema.parse(input);

  const api = getAPIClient();
  await api.deletePost(validated.postUrn);

  return {
    postUrn: validated.postUrn,
    message: 'Post deleted successfully',
    success: true
  };
}

/**
 * Get OAuth authorization URL for user to visit
 * Uses our OAuth relay service for seamless authentication
 * Starts a local callback server to automatically receive credentials
 * @returns {Promise<import('./types').GetAuthUrlOutput>}
 */
async function linkedin_get_auth_url() {
  const OAUTH_RELAY_URL = process.env.OAUTH_RELAY_URL || 'https://linkedin-oauth-relay.fly.dev';

  // Start local callback server
  const { port, nonce, waitForCallback } = await startCallbackServer();

  // Build auth URL with port and nonce for local callback
  const authUrl = `${OAUTH_RELAY_URL}/auth/linkedin?port=${port}&nonce=${nonce}`;

  // Wait for callback in background and auto-store credentials
  waitForCallback()
    .then((credentials) => {
      // Store in OS keychain
      storeCredentials(credentials);

      // Also set in current process so tools work immediately
      process.env.LINKEDIN_ACCESS_TOKEN = credentials.accessToken;
      process.env.LINKEDIN_PERSON_ID = credentials.personId;

      console.error('[mcp-linkedin] OAuth successful - credentials stored in keychain');
    })
    .catch((err) => {
      console.error('[mcp-linkedin] OAuth failed:', err.message);
    });

  return {
    authUrl,
    state: nonce,
    instructions: `1. Click the link above to authenticate with LinkedIn
2. After you approve, you'll see a "LinkedIn Connected!" success page
3. Your credentials will be automatically and securely stored in your OS keychain
4. Return here - the LinkedIn tools should work immediately!

Note: If the page doesn't load, you may need to manually use linkedin_save_credentials with the callback URL.`
  };
}

/**
 * Save credentials from OAuth callback URL
 * Stores securely in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 * @param {object} input
 * @param {string} input.callbackUrl - The full callback URL from browser after OAuth
 * @returns {Promise<object>}
 */
async function linkedin_save_credentials(input) {
  const { callbackUrl } = input;

  // Parse the URL to extract parameters
  const url = new URL(callbackUrl);
  const params = url.searchParams;

  const accessToken = params.get('access_token');
  const personId = params.get('person_id');
  const refreshToken = params.get('refresh_token');
  const expiresIn = params.get('expires_in');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    return {
      success: false,
      error,
      message: errorDescription || 'OAuth authentication failed'
    };
  }

  if (!accessToken || !personId) {
    return {
      success: false,
      error: 'missing_params',
      message: 'Could not find access_token or person_id in the callback URL'
    };
  }

  const credentials = {
    accessToken,
    personId,
    refreshToken: refreshToken || null,
    expiresAt: expiresIn ? Date.now() + parseInt(expiresIn, 10) * 1000 : null,
    savedAt: new Date().toISOString()
  };

  try {
    // Store in OS keychain
    storeCredentials(credentials);

    // Also set in current process so tools work immediately
    process.env.LINKEDIN_ACCESS_TOKEN = accessToken;
    process.env.LINKEDIN_PERSON_ID = personId;

    return {
      success: true,
      accessToken: maskToken(accessToken),
      personId,
      message: `Credentials securely stored in your OS keychain.

You're all set! The LinkedIn tools should work now. Try creating a post!`
    };
  } catch (err) {
    return {
      success: false,
      error: 'save_failed',
      message: `Could not save credentials to keychain: ${err.message}

On Linux, make sure libsecret is installed: sudo apt install libsecret-1-dev

Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_ID in your .env file as a fallback.
Access token (masked): ${maskToken(accessToken)}
Person ID: ${personId}`
    };
  }
}

/**
 * Exchange authorization code for access token
 * @param {import('./types').ExchangeCodeInput} input
 * @returns {Promise<import('./types').ExchangeCodeOutput>}
 */
async function linkedin_exchange_code(input) {
  // Validate input
  const validated = schemas.ExchangeCodeInputSchema.parse(input);

  const tokenResponse = await LinkedInAPI.exchangeAuthCode({
    code: validated.authorizationCode,
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI
  });

  // Get user info to extract person ID
  const tempAPI = new LinkedInAPI({
    accessToken: tokenResponse.access_token,
    apiVersion: process.env.LINKEDIN_API_VERSION,
    personId: 'temp' // Will be replaced
  });

  const userInfo = await tempAPI.getUserInfo();
  const personUrn = `urn:li:person:${userInfo.sub}`;

  return {
    accessToken: maskToken(tokenResponse.access_token),
    expiresIn: tokenResponse.expires_in,
    personUrn,
    message: `Success! Credentials have been obtained. Store them in your OS keychain using linkedin_save_credentials or set env vars.\nAccess token (masked): ${maskToken(tokenResponse.access_token)}\nPerson ID: ${userInfo.sub}`
  };
}

/**
 * Get current user's profile information
 * @returns {Promise<import('./types').GetUserInfoOutput>}
 */
async function linkedin_get_user_info() {
  const api = getAPIClient();
  const userInfo = await api.getUserInfo();

  return {
    personUrn: `urn:li:person:${userInfo.sub}`,
    name: userInfo.name,
    email: userInfo.email,
    pictureUrl: userInfo.picture
  };
}

/**
 * Update an existing LinkedIn post
 * @param {import('./types').UpdatePostInput} input
 * @returns {Promise<import('./types').UpdatePostOutput>}
 */
async function linkedin_update_post(input) {
  // Validate input
  const validated = schemas.UpdatePostInputSchema.parse(input);

  const api = getAPIClient();

  const updateData = {};
  if (validated.commentary) {
    updateData.commentary = validated.commentary;
  }
  if (validated.contentCallToActionLabel) {
    updateData.contentCallToActionLabel = validated.contentCallToActionLabel;
  }
  if (validated.contentLandingPage) {
    updateData.contentLandingPage = validated.contentLandingPage;
  }

  await api.updatePost(validated.postUrn, updateData);

  return {
    postUrn: validated.postUrn,
    message: 'Post updated successfully',
    success: true
  };
}

/**
 * Get MIME type from file extension
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get MIME type for documents
 * @param {string} filePath - Path to the document
 * @returns {string} MIME type
 */
function getDocumentMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get MIME type for videos
 * @param {string} filePath - Path to the video
 * @returns {string} MIME type
 */
function getVideoMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.m4v': 'video/x-m4v',
    '.flv': 'video/x-flv'
  };
  return mimeTypes[ext] || 'video/mp4';
}

/**
 * Validate video file extension
 * @param {string} filePath - Path to the video
 * @returns {boolean} True if valid extension
 */
function isValidVideoType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.webm', '.mkv', '.m4v', '.flv'];
  return validExtensions.includes(ext);
}

/**
 * Validate image file extension
 * @param {string} filePath - Path to the image
 * @returns {boolean} True if valid extension
 */
function isValidImageType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
  return validExtensions.includes(ext);
}

/**
 * Validate document file extension
 * @param {string} filePath - Path to the document
 * @returns {boolean} True if valid extension
 */
function isValidDocumentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
  return validExtensions.includes(ext);
}

/**
 * Create a post with an uploaded image
 * @param {import('./types').CreatePostWithImageInput} input
 * @returns {Promise<import('./types').CreatePostWithImageOutput>}
 */
async function linkedin_create_post_with_image(input) {
  // Validate input
  const validated = schemas.CreatePostWithImageInputSchema.parse(input);

  // Verify file exists and is readable
  if (!fs.existsSync(validated.imagePath)) {
    throw new Error(`Image file not found: ${validated.imagePath}`);
  }

  const api = getAPIClient();

  // Step 1: Initialize upload to get upload URL
  const { uploadUrl, imageUrn } = await api.initializeImageUpload();

  // Step 2: Read image and upload binary
  const imageBuffer = fs.readFileSync(validated.imagePath);
  const contentType = getMimeType(validated.imagePath);
  await api.uploadImageBinary(uploadUrl, imageBuffer, contentType);

  // Step 3: Create post with the uploaded image
  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary,
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    content: {
      media: {
        id: imageUrn,
        ...(validated.altText && { altText: validated.altText })
      }
    },
    lifecycleState: 'PUBLISHED'
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    imageUrn: imageUrn,
    message: 'Post with image created successfully',
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`
  };
}

/**
 * Refresh an expired access token using a refresh token
 * @param {Object} input
 * @param {string} input.refreshToken - The refresh token
 * @returns {Promise<import('./types').RefreshTokenOutput>}
 */
async function linkedin_refresh_token(input) {
  const { refreshToken } = input;

  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  const tokenResponse = await LinkedInAPI.refreshAccessToken({
    refreshToken,
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET
  });

  return {
    accessToken: maskToken(tokenResponse.access_token),
    expiresIn: tokenResponse.expires_in,
    message: `Token refreshed! Expires in ${Math.floor(tokenResponse.expires_in / 86400)} days.\nAccess token (masked): ${maskToken(tokenResponse.access_token)}`
  };
}

/**
 * Add a comment to a LinkedIn post
 * @param {import('./types').AddCommentInput} input
 * @returns {Promise<import('./types').AddCommentOutput>}
 */
async function linkedin_add_comment(input) {
  // Validate input
  const validated = schemas.AddCommentInputSchema.parse(input);

  const api = getAPIClient();
  const result = await api.addComment(validated.postUrn, validated.text);

  return {
    commentUrn: result.commentUrn,
    postUrn: validated.postUrn,
    message: 'Comment added successfully',
    success: true
  };
}

/**
 * Add a reaction to a LinkedIn post
 * @param {import('./types').AddReactionInput} input
 * @returns {Promise<import('./types').AddReactionOutput>}
 */
async function linkedin_add_reaction(input) {
  // Validate input
  const validated = schemas.AddReactionInputSchema.parse(input);

  const api = getAPIClient();
  await api.addReaction(validated.postUrn, validated.reactionType);

  return {
    postUrn: validated.postUrn,
    reactionType: validated.reactionType,
    message: `Reaction ${validated.reactionType} added successfully`,
    success: true
  };
}

// ============================================================================
// Scheduling Tools
// ============================================================================

/**
 * Schedule a LinkedIn post for future publication
 * @param {import('./types').SchedulePostInput} input
 * @returns {Promise<import('./types').SchedulePostOutput>}
 */
async function linkedin_schedule_post(input) {
  // Validate input (includes future time check)
  const validated = schemas.SchedulePostInputSchema.parse(input);

  const db = getDatabase();

  const scheduledPost = db.addScheduledPost({
    commentary: validated.commentary,
    scheduledTime: validated.scheduledTime,
    url: validated.url || null,
    visibility: validated.visibility
  });

  const scheduledDate = new Date(validated.scheduledTime);
  const formattedTime = scheduledDate.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return {
    postId: scheduledPost.id,
    scheduledTime: scheduledPost.scheduledTime,
    status: scheduledPost.status,
    message: `Post scheduled for ${formattedTime}`
  };
}

/**
 * List scheduled posts, optionally filtered by status
 * @param {import('./types').ListScheduledPostsInput} input
 * @returns {Promise<import('./types').ListScheduledPostsOutput>}
 */
async function linkedin_list_scheduled_posts(input = {}) {
  // Validate input with defaults
  const validated = schemas.ListScheduledPostsInputSchema.parse(input);

  const db = getDatabase();
  const posts = db.getScheduledPosts(validated.status || null, validated.limit);

  const statusMsg = validated.status
    ? `${validated.status} posts`
    : 'all scheduled posts';

  return {
    posts,
    count: posts.length,
    message: `Found ${posts.length} ${statusMsg}`
  };
}

/**
 * Cancel a scheduled post (must be pending)
 * @param {import('./types').CancelScheduledPostInput} input
 * @returns {Promise<import('./types').CancelScheduledPostOutput>}
 */
async function linkedin_cancel_scheduled_post(input) {
  // Validate input
  const validated = schemas.CancelScheduledPostInputSchema.parse(input);

  const db = getDatabase();
  const cancelledPost = db.cancelPost(validated.postId);

  if (!cancelledPost) {
    throw new Error(`Post not found or not in pending status: ${validated.postId}`);
  }

  return {
    postId: cancelledPost.id,
    status: 'cancelled',
    message: 'Scheduled post cancelled successfully',
    success: true
  };
}

/**
 * Create a LinkedIn poll post
 * @param {import('./types').CreatePollInput} input
 * @returns {Promise<import('./types').CreatePollOutput>}
 */
async function linkedin_create_poll(input) {
  // Validate input
  const validated = schemas.CreatePollInputSchema.parse(input);

  const api = getAPIClient();

  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary || '',
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    lifecycleState: 'PUBLISHED',
    content: {
      poll: {
        question: validated.question,
        options: validated.options.map(opt => ({ text: opt.text })),
        settings: {
          duration: validated.duration,
          voteSelectionType: 'SINGLE_VOTE',
          isVoterVisibleToAuthor: true
        }
      }
    }
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    message: 'Poll created successfully',
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`,
    pollQuestion: validated.question,
    optionCount: validated.options.length,
    duration: validated.duration
  };
}

/**
 * Create a LinkedIn post with an uploaded document
 * @param {import('./types').CreatePostWithDocumentInput} input
 * @returns {Promise<import('./types').CreatePostWithDocumentOutput>}
 */
async function linkedin_create_post_with_document(input) {
  // Validate input
  const validated = schemas.CreatePostWithDocumentInputSchema.parse(input);

  // Verify file exists and is readable
  if (!fs.existsSync(validated.documentPath)) {
    throw new Error(`Document file not found: ${validated.documentPath}`);
  }

  // Validate file type
  if (!isValidDocumentType(validated.documentPath)) {
    throw new Error('Invalid document type. Supported formats: PDF, DOC, DOCX, PPT, PPTX');
  }

  // Check file size (max 100 MB)
  const stats = fs.statSync(validated.documentPath);
  const maxSize = 100 * 1024 * 1024; // 100 MB
  if (stats.size > maxSize) {
    throw new Error('Document file size exceeds 100 MB limit');
  }

  const api = getAPIClient();

  // Step 1: Initialize upload to get upload URL
  const { uploadUrl, documentUrn } = await api.initializeDocumentUpload();

  // Step 2: Read document and upload binary
  const documentBuffer = fs.readFileSync(validated.documentPath);
  const contentType = getDocumentMimeType(validated.documentPath);
  await api.uploadDocumentBinary(uploadUrl, documentBuffer, contentType);

  // Step 3: Create post with the uploaded document
  const documentTitle = validated.title || path.basename(validated.documentPath);

  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary,
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    content: {
      media: {
        id: documentUrn,
        title: documentTitle
      }
    },
    lifecycleState: 'PUBLISHED'
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    documentUrn: documentUrn,
    message: 'Post with document created successfully',
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`
  };
}

/**
 * Get details of a single scheduled post
 * @param {import('./types').GetScheduledPostInput} input
 * @returns {Promise<import('./types').GetScheduledPostOutput>}
 */
async function linkedin_get_scheduled_post(input) {
  // Validate input
  const validated = schemas.GetScheduledPostInputSchema.parse(input);

  const db = getDatabase();
  const post = db.getScheduledPost(validated.postId);

  if (!post) {
    throw new Error(`Scheduled post not found: ${validated.postId}`);
  }

  let statusMessage;
  switch (post.status) {
    case 'pending':
      statusMessage = `Scheduled for ${new Date(post.scheduledTime).toLocaleString()}`;
      break;
    case 'published':
      statusMessage = `Published at ${new Date(post.publishedAt).toLocaleString()}`;
      break;
    case 'failed':
      statusMessage = `Failed: ${post.errorMessage} (${post.retryCount} attempts)`;
      break;
    case 'cancelled':
      statusMessage = 'Cancelled';
      break;
    default:
      statusMessage = `Status: ${post.status}`;
  }

  return {
    post,
    message: statusMessage
  };
}

/**
 * Create a LinkedIn post with an uploaded video
 * @param {import('./types').CreatePostWithVideoInput} input
 * @returns {Promise<import('./types').CreatePostWithVideoOutput>}
 */
async function linkedin_create_post_with_video(input) {
  // Validate input
  const validated = schemas.CreatePostWithVideoInputSchema.parse(input);

  // Verify file exists and is readable
  if (!fs.existsSync(validated.videoPath)) {
    throw new Error(`Video file not found: ${validated.videoPath}`);
  }

  // Validate file type
  if (!isValidVideoType(validated.videoPath)) {
    throw new Error('Invalid video type. Supported formats: MP4, MOV, AVI, WMV, WebM, MKV, M4V, FLV');
  }

  // Check file size (max 200 MB for personal accounts, 5 GB for company pages)
  const stats = fs.statSync(validated.videoPath);
  const maxSize = 200 * 1024 * 1024; // 200 MB
  if (stats.size > maxSize) {
    throw new Error('Video file size exceeds 200 MB limit for personal accounts');
  }

  const api = getAPIClient();

  // Step 1: Initialize upload to get upload URL
  const { uploadUrl, videoUrn } = await api.initializeVideoUpload(stats.size);

  // Step 2: Read video and upload binary
  const videoBuffer = fs.readFileSync(validated.videoPath);
  const contentType = getVideoMimeType(validated.videoPath);
  const { etag } = await api.uploadVideoBinary(uploadUrl, videoBuffer, contentType);

  // Step 3: Finalize upload
  await api.finalizeVideoUpload(videoUrn, uploadUrl, etag);

  // Step 4: Create post with the uploaded video
  const videoTitle = validated.title || path.basename(validated.videoPath);

  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary,
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    content: {
      media: {
        id: videoUrn,
        title: videoTitle
      }
    },
    lifecycleState: 'PUBLISHED'
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    videoUrn: videoUrn,
    message: 'Post with video created successfully',
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`
  };
}

/**
 * Create a LinkedIn post with multiple images
 * @param {import('./types').CreatePostWithMultiImagesInput} input
 * @returns {Promise<import('./types').CreatePostWithMultiImagesOutput>}
 */
async function linkedin_create_post_with_multi_images(input) {
  // Validate input
  const validated = schemas.CreatePostWithMultiImagesInputSchema.parse(input);

  // Verify all files exist and are valid image types
  for (const imagePath of validated.imagePaths) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
    if (!isValidImageType(imagePath)) {
      throw new Error(`Invalid image type: ${imagePath}. Supported formats: PNG, JPG, JPEG, GIF`);
    }
  }

  const api = getAPIClient();

  // Step 1: Initialize uploads for all images
  const uploadInfos = await api.initializeMultiImageUpload(validated.imagePaths.length);

  // Step 2: Upload all images
  const imageUrns = [];
  for (let i = 0; i < validated.imagePaths.length; i++) {
    const imagePath = validated.imagePaths[i];
    const { uploadUrl, imageUrn } = uploadInfos[i];

    const imageBuffer = fs.readFileSync(imagePath);
    const contentType = getMimeType(imagePath);
    await api.uploadImageBinary(uploadUrl, imageBuffer, contentType);

    imageUrns.push(imageUrn);
  }

  // Step 3: Build multi-image content
  const images = imageUrns.map((urn, index) => {
    const imageObj = { id: urn };
    if (validated.altTexts && validated.altTexts[index]) {
      imageObj.altText = validated.altTexts[index];
    }
    return imageObj;
  });

  // Step 4: Create post with multi-image content
  const postData = {
    author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
    commentary: validated.commentary,
    visibility: validated.visibility,
    distribution: {
      feedDistribution: 'MAIN_FEED'
    },
    content: {
      multiImage: {
        images
      }
    },
    lifecycleState: 'PUBLISHED'
  };

  const result = await api.createPost(postData);

  return {
    postUrn: result.postUrn,
    imageUrns: imageUrns,
    message: `Post with ${imageUrns.length} images created successfully`,
    url: `https://www.linkedin.com/feed/update/${result.postUrn}`
  };
}

module.exports = {
  maskToken,
  linkedin_create_post,
  linkedin_create_post_with_link,
  linkedin_get_my_posts,
  linkedin_delete_post,
  linkedin_get_auth_url,
  linkedin_save_credentials,
  linkedin_exchange_code,
  linkedin_get_user_info,
  linkedin_update_post,
  linkedin_create_post_with_image,
  linkedin_refresh_token,
  linkedin_add_comment,
  linkedin_add_reaction,
  // Scheduling tools
  linkedin_schedule_post,
  linkedin_list_scheduled_posts,
  linkedin_cancel_scheduled_post,
  linkedin_get_scheduled_post,
  // Rich media tools
  linkedin_create_poll,
  linkedin_create_post_with_document,
  linkedin_create_post_with_video,
  linkedin_create_post_with_multi_images
};
