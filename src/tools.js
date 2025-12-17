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
        ...(validated.title && { title: validated.title }),
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
 * @returns {Promise<import('./types').GetAuthUrlOutput>}
 */
async function linkedin_get_auth_url() {
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    scope: 'openid profile email w_member_social',
    state
  });

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

  return {
    authUrl,
    state,
    instructions: 'Visit this URL in your browser, authorize the app, then copy the authorization code from the callback URL'
  };
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
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
    personUrn,
    message: `Success! Save these to your .env file:\nLINKEDIN_ACCESS_TOKEN=${tokenResponse.access_token}\nLINKEDIN_PERSON_ID=${userInfo.sub}`
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
    accessToken: tokenResponse.access_token,
    expiresIn: tokenResponse.expires_in,
    message: `Token refreshed! Expires in ${Math.floor(tokenResponse.expires_in / 86400)} days.\nUpdate your .env:\nLINKEDIN_ACCESS_TOKEN=${tokenResponse.access_token}`
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

module.exports = {
  linkedin_create_post,
  linkedin_create_post_with_link,
  linkedin_get_my_posts,
  linkedin_delete_post,
  linkedin_get_auth_url,
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
  linkedin_get_scheduled_post
};
