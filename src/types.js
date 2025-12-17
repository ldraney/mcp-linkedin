/**
 * @file Type definitions for MCP-LinkedIn
 * All types are defined with JSDoc comments for IDE support and documentation.
 * These types are validated at runtime using Zod schemas.
 */

// ============================================================================
// LinkedIn API Types
// ============================================================================

/**
 * LinkedIn post visibility levels
 * @typedef {'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN' | 'CONTAINER'} Visibility
 */

/**
 * Feed distribution options
 * @typedef {'MAIN_FEED' | 'NONE'} FeedDistribution
 */

/**
 * Post lifecycle state
 * @typedef {'PUBLISHED' | 'DRAFT'} LifecycleState
 */

/**
 * LinkedIn URN for a person
 * Format: "urn:li:person:{id}"
 * @typedef {string} PersonURN
 */

/**
 * LinkedIn URN for a post (share or ugcPost)
 * Format: "urn:li:share:{id}" or "urn:li:ugcPost:{id}"
 * @typedef {string} PostURN
 */

/**
 * LinkedIn URN for an image
 * Format: "urn:li:image:{id}"
 * @typedef {string} ImageURN
 */

/**
 * Distribution configuration for a post
 * @typedef {Object} Distribution
 * @property {FeedDistribution} feedDistribution - Where the post appears
 * @property {Array<string>} [targetEntities] - Optional targeting criteria
 * @property {Array<string>} [thirdPartyDistributionChannels] - External channels
 */

/**
 * Article/link content for a post
 * @typedef {Object} Article
 * @property {string} source - URL of the article/link
 * @property {string} [title] - Custom title (overrides scraped data)
 * @property {string} [description] - Custom description
 */

/**
 * Media content for a post (image/video)
 * @typedef {Object} Media
 * @property {ImageURN} id - URN of the uploaded media
 * @property {string} [altText] - Accessibility text
 */

/**
 * Content for a LinkedIn post
 * @typedef {Object} PostContent
 * @property {Article} [article] - Link/article preview
 * @property {Media} [media] - Image or video
 */

/**
 * Complete LinkedIn post object (API request format)
 * @typedef {Object} LinkedInPost
 * @property {PersonURN} author - Author's person URN
 * @property {string} commentary - Post text content
 * @property {Visibility} visibility - Who can see the post
 * @property {Distribution} distribution - Distribution settings
 * @property {LifecycleState} lifecycleState - Publication state
 * @property {PostContent} [content] - Optional media/link content
 * @property {boolean} [isReshareDisabledByAuthor] - Disable sharing
 */

/**
 * LinkedIn API response for post creation
 * @typedef {Object} CreatePostResponse
 * @property {PostURN} postUrn - URN of the created post
 * @property {number} statusCode - HTTP status code (201 for success)
 */

/**
 * LinkedIn post metadata (API response format)
 * @typedef {Object} PostMetadata
 * @property {PostURN} id - Post URN
 * @property {PersonURN} author - Author URN
 * @property {string} commentary - Post text
 * @property {Visibility} visibility - Visibility level
 * @property {string} createdAt - ISO timestamp
 * @property {string} [lastModifiedAt] - ISO timestamp of last edit
 * @property {LifecycleState} lifecycleState - Current state
 */

/**
 * Paginated list of posts (API response)
 * @typedef {Object} PostList
 * @property {Array<PostMetadata>} elements - Array of posts
 * @property {Object} paging - Pagination info
 * @property {number} paging.count - Results in this page
 * @property {number} paging.start - Offset of this page
 * @property {number} [paging.total] - Total available results
 */

/**
 * LinkedIn user profile information
 * @typedef {Object} UserInfo
 * @property {string} sub - Person ID (used in URN)
 * @property {string} name - Full name
 * @property {string} given_name - First name
 * @property {string} family_name - Last name
 * @property {string} email - Email address
 * @property {boolean} email_verified - Email verification status
 * @property {string} picture - Profile picture URL
 * @property {Object} locale - Locale settings
 * @property {string} locale.country - Country code
 * @property {string} locale.language - Language code
 */

/**
 * OAuth 2.0 token response
 * @typedef {Object} TokenResponse
 * @property {string} access_token - Bearer token for API requests
 * @property {number} expires_in - Seconds until expiry
 * @property {string} scope - Granted permissions (space-separated)
 * @property {string} token_type - Always "Bearer"
 * @property {string} [refresh_token] - Token for renewal (if supported)
 * @property {string} [id_token] - OpenID Connect ID token (JWT)
 */

// ============================================================================
// MCP Tool Input/Output Types
// ============================================================================

/**
 * Input parameters for creating a simple text post
 * @typedef {Object} CreatePostInput
 * @property {string} commentary - Post text (supports hashtags, mentions)
 * @property {Visibility} [visibility='PUBLIC'] - Who can see the post
 */

/**
 * Input parameters for creating a post with a link
 * @typedef {Object} CreatePostWithLinkInput
 * @property {string} commentary - Post text
 * @property {string} url - Link URL (GitHub, blog, etc.)
 * @property {string} [title] - Custom title for link preview
 * @property {string} [description] - Custom description for link preview
 * @property {Visibility} [visibility='PUBLIC'] - Who can see the post
 */

/**
 * Input parameters for retrieving posts
 * @typedef {Object} GetPostsInput
 * @property {number} [limit=10] - Max posts to retrieve (1-100)
 * @property {number} [offset=0] - Pagination offset
 */

/**
 * Input parameters for deleting a post
 * @typedef {Object} DeletePostInput
 * @property {PostURN} postUrn - URN of the post to delete
 */

/**
 * Input parameters for updating a post
 * @typedef {Object} UpdatePostInput
 * @property {PostURN} postUrn - URN of the post to update
 * @property {string} [commentary] - New post text (1-3000 characters)
 * @property {string} [contentCallToActionLabel] - New CTA label
 * @property {string} [contentLandingPage] - New landing page URL
 */

/**
 * Input parameters for creating a post with an image
 * @typedef {Object} CreatePostWithImageInput
 * @property {string} commentary - Post text (supports hashtags, mentions)
 * @property {string} imagePath - Local file path to the image (PNG, JPG, GIF)
 * @property {string} [altText] - Accessibility text for the image
 * @property {Visibility} [visibility='PUBLIC'] - Who can see the post
 */

/**
 * Input parameters for exchanging OAuth code for token
 * @typedef {Object} ExchangeCodeInput
 * @property {string} authorizationCode - Code from OAuth callback
 */

/**
 * Output from successful post creation
 * @typedef {Object} CreatePostOutput
 * @property {PostURN} postUrn - URN of created post
 * @property {string} message - Success message
 * @property {string} url - Link to view post on LinkedIn (if available)
 */

/**
 * Output from retrieving posts
 * @typedef {Object} GetPostsOutput
 * @property {Array<PostMetadata>} posts - Array of post metadata
 * @property {number} count - Number of posts returned
 * @property {number} offset - Current pagination offset
 * @property {boolean} hasMore - Whether more posts are available
 */

/**
 * Output from deleting a post
 * @typedef {Object} DeletePostOutput
 * @property {PostURN} postUrn - URN of deleted post
 * @property {string} message - Success message
 * @property {boolean} success - Always true if no error
 */

/**
 * Output from updating a post
 * @typedef {Object} UpdatePostOutput
 * @property {PostURN} postUrn - URN of updated post
 * @property {string} message - Success message
 * @property {boolean} success - Always true if no error
 */

/**
 * Output from creating a post with image
 * @typedef {Object} CreatePostWithImageOutput
 * @property {PostURN} postUrn - URN of created post
 * @property {ImageURN} imageUrn - URN of uploaded image
 * @property {string} message - Success message
 * @property {string} url - Link to view post on LinkedIn
 */

/**
 * Output from refreshing an access token
 * @typedef {Object} RefreshTokenOutput
 * @property {string} accessToken - New access token
 * @property {number} expiresIn - Seconds until expiry
 * @property {string} message - Success message with save instructions
 */

/**
 * Output from getting OAuth authorization URL
 * @typedef {Object} GetAuthUrlOutput
 * @property {string} authUrl - URL for user to visit
 * @property {string} state - CSRF protection state value
 * @property {string} instructions - How to use the URL
 */

/**
 * Output from exchanging OAuth code
 * @typedef {Object} ExchangeCodeOutput
 * @property {string} accessToken - Bearer token for API
 * @property {number} expiresIn - Seconds until expiry
 * @property {PersonURN} personUrn - User's person URN
 * @property {string} message - Success message with save instructions
 */

/**
 * Output from getting user info
 * @typedef {Object} GetUserInfoOutput
 * @property {PersonURN} personUrn - User's person URN
 * @property {string} name - Full name
 * @property {string} email - Email address
 * @property {string} pictureUrl - Profile picture URL
 */

// ============================================================================
// Scheduling Types
// ============================================================================

/**
 * Status of a scheduled post
 * @typedef {'pending' | 'published' | 'failed' | 'cancelled'} ScheduledPostStatus
 */

/**
 * A scheduled LinkedIn post stored in the database
 * @typedef {Object} ScheduledPost
 * @property {string} id - Unique UUID for the scheduled post
 * @property {string} commentary - Post text content
 * @property {string|null} url - Optional URL for link posts
 * @property {Visibility} visibility - Post visibility level
 * @property {string} scheduledTime - ISO 8601 datetime when post should be published
 * @property {ScheduledPostStatus} status - Current status of the scheduled post
 * @property {string} createdAt - ISO 8601 datetime when the post was scheduled
 * @property {string|null} publishedAt - ISO 8601 datetime when the post was actually published
 * @property {PostURN|null} postUrn - URN of the post after publishing
 * @property {string|null} errorMessage - Error message if publishing failed
 * @property {number} retryCount - Number of publish attempts
 */

/**
 * Input parameters for scheduling a post
 * @typedef {Object} SchedulePostInput
 * @property {string} commentary - Post text (supports hashtags, mentions)
 * @property {string} scheduledTime - ISO 8601 datetime (must be in the future)
 * @property {string} [url] - Optional URL for link posts
 * @property {Visibility} [visibility='PUBLIC'] - Who can see the post
 */

/**
 * Input parameters for listing scheduled posts
 * @typedef {Object} ListScheduledPostsInput
 * @property {ScheduledPostStatus} [status] - Filter by status
 * @property {number} [limit=50] - Max posts to retrieve (1-100)
 */

/**
 * Input parameters for cancelling a scheduled post
 * @typedef {Object} CancelScheduledPostInput
 * @property {string} postId - UUID of the scheduled post to cancel
 */

/**
 * Input parameters for getting a single scheduled post
 * @typedef {Object} GetScheduledPostInput
 * @property {string} postId - UUID of the scheduled post
 */

/**
 * Output from scheduling a post
 * @typedef {Object} SchedulePostOutput
 * @property {string} postId - UUID of the scheduled post
 * @property {string} scheduledTime - ISO 8601 datetime when post will be published
 * @property {ScheduledPostStatus} status - Current status (always 'pending')
 * @property {string} message - Success message
 */

/**
 * Output from listing scheduled posts
 * @typedef {Object} ListScheduledPostsOutput
 * @property {Array<ScheduledPost>} posts - Array of scheduled posts
 * @property {number} count - Number of posts returned
 * @property {string} message - Summary message
 */

/**
 * Output from cancelling a scheduled post
 * @typedef {Object} CancelScheduledPostOutput
 * @property {string} postId - UUID of the cancelled post
 * @property {'cancelled'} status - Status after cancellation
 * @property {string} message - Success message
 * @property {boolean} success - Always true if no error
 */

/**
 * Output from getting a scheduled post
 * @typedef {Object} GetScheduledPostOutput
 * @property {ScheduledPost} post - The scheduled post details
 * @property {string} message - Status message
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standardized error response
 * @typedef {Object} ErrorResponse
 * @property {string} error - Error type/code
 * @property {string} message - Human-readable error message
 * @property {number} [statusCode] - HTTP status code (if from API)
 * @property {Object} [details] - Additional error context
 */

/**
 * LinkedIn API error response
 * @typedef {Object} LinkedInAPIError
 * @property {string} error - Error code
 * @property {string} error_description - Error message
 * @property {number} status - HTTP status code
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * LinkedIn OAuth configuration
 * @typedef {Object} OAuthConfig
 * @property {string} clientId - LinkedIn app client ID
 * @property {string} clientSecret - LinkedIn app client secret
 * @property {string} redirectUri - OAuth callback URL
 * @property {Array<string>} scope - Requested permissions
 */

/**
 * LinkedIn API configuration
 * @typedef {Object} APIConfig
 * @property {string} baseUrl - API base URL (https://api.linkedin.com)
 * @property {string} version - API version (YYYYMM format)
 * @property {string} accessToken - Bearer token
 * @property {PersonURN} personId - User's person URN
 */

/**
 * Complete application configuration
 * @typedef {Object} AppConfig
 * @property {OAuthConfig} oauth - OAuth settings
 * @property {APIConfig} api - API settings
 */

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Retry configuration for API requests
 * @typedef {Object} RetryConfig
 * @property {number} maxRetries - Max retry attempts (default: 3)
 * @property {number} initialDelay - Initial delay in ms (default: 1000)
 * @property {number} maxDelay - Max delay in ms (default: 30000)
 * @property {number} backoffMultiplier - Delay multiplier (default: 2)
 */

/**
 * Result of a retry attempt
 * @typedef {Object} RetryResult
 * @property {boolean} success - Whether operation succeeded
 * @property {*} [data] - Result data if successful
 * @property {Error} [error] - Error if failed
 * @property {number} attempts - Number of attempts made
 */

// ============================================================================
// MCP Server Types
// ============================================================================

/**
 * MCP tool definition
 * @typedef {Object} MCPTool
 * @property {string} name - Tool name (e.g., "linkedin_create_post")
 * @property {string} description - What the tool does
 * @property {Object} inputSchema - JSON schema for input validation
 * @property {Function} handler - Async function to execute the tool
 */

/**
 * MCP tool call arguments
 * @typedef {Object} ToolCallArguments
 * @property {string} name - Tool name being called
 * @property {Object} arguments - Tool-specific arguments
 */

/**
 * MCP tool execution result
 * @typedef {Object} ToolExecutionResult
 * @property {Array<Object>} content - Result content blocks
 * @property {boolean} [isError] - Whether execution failed
 */

// Export JSDoc types (for documentation purposes)
module.exports = {};
