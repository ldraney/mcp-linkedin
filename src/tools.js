/**
 * @file LinkedIn MCP Tools Implementation
 * All 7 core tools for LinkedIn posting and authentication
 */

require('dotenv').config();
const crypto = require('crypto');
const LinkedInAPI = require('./linkedin-api');
const schemas = require('./schemas');

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

module.exports = {
  linkedin_create_post,
  linkedin_create_post_with_link,
  linkedin_get_my_posts,
  linkedin_delete_post,
  linkedin_get_auth_url,
  linkedin_exchange_code,
  linkedin_get_user_info
};
