/**
 * @file Zod validation schemas for MCP-LinkedIn
 * Runtime validation for all inputs/outputs matching types.js JSDoc definitions
 */

const { z } = require('zod');

// ============================================================================
// LinkedIn API Schemas
// ============================================================================

/** @type {import('zod').ZodEnum} */
const VisibilitySchema = z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER']);

/** @type {import('zod').ZodEnum} */
const FeedDistributionSchema = z.enum(['MAIN_FEED', 'NONE']);

/** @type {import('zod').ZodEnum} */
const LifecycleStateSchema = z.enum(['PUBLISHED', 'DRAFT']);

/** @type {import('zod').ZodString} */
const PersonURNSchema = z.string().regex(/^urn:li:person:.+$/, 'Invalid person URN format');

/** @type {import('zod').ZodString} */
const PostURNSchema = z.string().regex(/^urn:li:(share|ugcPost):.+$/, 'Invalid post URN format');

/** @type {import('zod').ZodString} */
const ImageURNSchema = z.string().regex(/^urn:li:image:.+$/, 'Invalid image URN format');

/** @type {import('zod').ZodString} */
const CommentURNSchema = z.string().regex(/^urn:li:comment:\(.+,.+\)$/, 'Invalid comment URN format');

/** @type {import('zod').ZodEnum} */
const ReactionTypeSchema = z.enum(['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT']);

/** @type {import('zod').ZodEnum} */
const PollDurationSchema = z.enum(['ONE_DAY', 'THREE_DAYS', 'SEVEN_DAYS', 'FOURTEEN_DAYS']);

/** @type {import('zod').ZodString} */
const DocumentURNSchema = z.string().regex(/^urn:li:document:.+$/, 'Invalid document URN format');

/** @type {import('zod').ZodString} */
const VideoURNSchema = z.string().regex(/^urn:li:video:.+$/, 'Invalid video URN format');

/** @type {import('zod').ZodObject} */
const DistributionSchema = z.object({
  feedDistribution: FeedDistributionSchema,
  targetEntities: z.array(z.string()).optional(),
  thirdPartyDistributionChannels: z.array(z.string()).optional()
});

/** @type {import('zod').ZodObject} */
const ArticleSchema = z.object({
  source: z.string().url('Invalid article URL'),
  title: z.string().optional(),
  description: z.string().optional()
});

/** @type {import('zod').ZodObject} */
const MediaSchema = z.object({
  id: ImageURNSchema,
  altText: z.string().optional()
});

/** @type {import('zod').ZodObject} */
const PostContentSchema = z.object({
  article: ArticleSchema.optional(),
  media: MediaSchema.optional()
});

/** @type {import('zod').ZodObject} */
const LinkedInPostSchema = z.object({
  author: PersonURNSchema,
  commentary: z.string().min(1, 'Commentary cannot be empty').max(3000, 'Commentary too long'),
  visibility: VisibilitySchema,
  distribution: DistributionSchema,
  lifecycleState: LifecycleStateSchema,
  content: PostContentSchema.optional(),
  isReshareDisabledByAuthor: z.boolean().optional()
});

/** @type {import('zod').ZodObject} */
const CreatePostResponseSchema = z.object({
  postUrn: PostURNSchema,
  statusCode: z.number()
});

/** @type {import('zod').ZodObject} */
const PostMetadataSchema = z.object({
  id: PostURNSchema,
  author: PersonURNSchema,
  commentary: z.string(),
  visibility: VisibilitySchema,
  createdAt: z.string().datetime(),
  lastModifiedAt: z.string().datetime().optional(),
  lifecycleState: LifecycleStateSchema
});

/** @type {import('zod').ZodObject} */
const PostListSchema = z.object({
  elements: z.array(PostMetadataSchema),
  paging: z.object({
    count: z.number(),
    start: z.number(),
    total: z.number().optional()
  })
});

/** @type {import('zod').ZodObject} */
const UserInfoSchema = z.object({
  sub: z.string(),
  name: z.string(),
  given_name: z.string(),
  family_name: z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
  picture: z.string().url(),
  locale: z.object({
    country: z.string(),
    language: z.string()
  })
});

/** @type {import('zod').ZodObject} */
const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  scope: z.string(),
  token_type: z.literal('Bearer'),
  refresh_token: z.string().optional(),
  id_token: z.string().optional()
});

// ============================================================================
// Scheduling Schemas
// ============================================================================

/** @type {import('zod').ZodEnum} */
const ScheduledPostStatusSchema = z.enum(['pending', 'published', 'failed', 'cancelled']);

/** @type {import('zod').ZodObject} */
const ScheduledPostSchema = z.object({
  id: z.string().uuid(),
  commentary: z.string().min(1).max(3000),
  url: z.string().url().nullable(),
  visibility: VisibilitySchema,
  scheduledTime: z.string().datetime(),
  status: ScheduledPostStatusSchema,
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  postUrn: PostURNSchema.nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number().int().min(0)
});

// ============================================================================
// MCP Tool Input Schemas
// ============================================================================

/** @type {import('zod').ZodObject} */
const CreatePostInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  visibility: VisibilitySchema.default('PUBLIC')
});

/** @type {import('zod').ZodObject} */
const CreatePostWithLinkInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  url: z.string().url('Invalid URL format'),
  title: z.string().optional(),
  description: z.string().optional(),
  visibility: VisibilitySchema.default('PUBLIC')
});

/** @type {import('zod').ZodObject} */
const GetPostsInputSchema = z.object({
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10),
  offset: z.number()
    .int('Offset must be an integer')
    .min(0, 'Offset cannot be negative')
    .default(0)
});

/** @type {import('zod').ZodObject} */
const DeletePostInputSchema = z.object({
  postUrn: PostURNSchema
});

/** @type {import('zod').ZodObject} */
const ExchangeCodeInputSchema = z.object({
  authorizationCode: z.string().min(1, 'Authorization code cannot be empty')
});

/** @type {import('zod').ZodObject} */
const UpdatePostInputSchema = z.object({
  postUrn: PostURNSchema,
  commentary: z.string().min(1).max(3000).optional(),
  contentCallToActionLabel: z.string().optional(),
  contentLandingPage: z.string().url().optional()
}).refine(
  data => data.commentary || data.contentCallToActionLabel || data.contentLandingPage,
  { message: 'At least one field to update is required' }
);

/** @type {import('zod').ZodObject} */
const CreatePostWithImageInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  imagePath: z.string().min(1, 'Image path cannot be empty'),
  altText: z.string().max(300).optional(),
  visibility: VisibilitySchema.default('PUBLIC')
});

/** @type {import('zod').ZodObject} */
const AddCommentInputSchema = z.object({
  postUrn: PostURNSchema,
  text: z.string()
    .min(1, 'Comment text cannot be empty')
    .max(1250, 'Comment must be 1250 characters or less')
});

/** @type {import('zod').ZodObject} */
const AddReactionInputSchema = z.object({
  postUrn: PostURNSchema,
  reactionType: ReactionTypeSchema
});

/** @type {import('zod').ZodObject} */
const SchedulePostInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  scheduledTime: z.string()
    .datetime({ message: 'scheduledTime must be a valid ISO 8601 datetime' }),
  url: z.string().url('Invalid URL format').optional(),
  visibility: VisibilitySchema.default('PUBLIC')
}).refine(
  data => new Date(data.scheduledTime) > new Date(),
  { message: 'scheduledTime must be in the future' }
);

/** @type {import('zod').ZodObject} */
const ListScheduledPostsInputSchema = z.object({
  status: ScheduledPostStatusSchema.optional(),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(50)
});

/** @type {import('zod').ZodObject} */
const CancelScheduledPostInputSchema = z.object({
  postId: z.string().uuid('Invalid post ID format')
});

/** @type {import('zod').ZodObject} */
const GetScheduledPostInputSchema = z.object({
  postId: z.string().uuid('Invalid post ID format')
});

/** @type {import('zod').ZodObject} */
const PollOptionSchema = z.object({
  text: z.string()
    .min(1, 'Option text cannot be empty')
    .max(30, 'Option text must be 30 characters or less')
});

/** @type {import('zod').ZodObject} */
const CreatePollInputSchema = z.object({
  question: z.string()
    .min(1, 'Poll question cannot be empty')
    .max(140, 'Poll question must be 140 characters or less'),
  options: z.array(PollOptionSchema)
    .min(2, 'Poll must have at least 2 options')
    .max(4, 'Poll cannot have more than 4 options'),
  duration: PollDurationSchema.default('THREE_DAYS'),
  commentary: z.string()
    .max(3000, 'Commentary must be 3000 characters or less')
    .optional(),
  visibility: VisibilitySchema.default('PUBLIC')
});

/** @type {import('zod').ZodObject} */
const CreatePostWithDocumentInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  documentPath: z.string().min(1, 'Document path cannot be empty'),
  title: z.string()
    .max(400, 'Title must be 400 characters or less')
    .optional(),
  visibility: VisibilitySchema.default('PUBLIC')
});

/** @type {import('zod').ZodObject} */
const CreatePostWithVideoInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  videoPath: z.string().min(1, 'Video path cannot be empty'),
  title: z.string()
    .max(400, 'Title must be 400 characters or less')
    .optional(),
  visibility: VisibilitySchema.default('PUBLIC')
});

/** @type {import('zod').ZodObject} */
const CreatePostWithMultiImagesInputSchema = z.object({
  commentary: z.string()
    .min(1, 'Commentary cannot be empty')
    .max(3000, 'Commentary must be 3000 characters or less'),
  imagePaths: z.array(z.string().min(1, 'Image path cannot be empty'))
    .min(2, 'Must provide at least 2 images')
    .max(20, 'Cannot upload more than 20 images'),
  altTexts: z.array(z.string().max(300)).optional(),
  visibility: VisibilitySchema.default('PUBLIC')
});

// ============================================================================
// MCP Tool Output Schemas
// ============================================================================

/** @type {import('zod').ZodObject} */
const CreatePostOutputSchema = z.object({
  postUrn: PostURNSchema,
  message: z.string(),
  url: z.string().url().optional()
});

/** @type {import('zod').ZodObject} */
const GetPostsOutputSchema = z.object({
  posts: z.array(PostMetadataSchema),
  count: z.number(),
  offset: z.number(),
  hasMore: z.boolean()
});

/** @type {import('zod').ZodObject} */
const DeletePostOutputSchema = z.object({
  postUrn: PostURNSchema,
  message: z.string(),
  success: z.literal(true)
});

/** @type {import('zod').ZodObject} */
const UpdatePostOutputSchema = z.object({
  postUrn: PostURNSchema,
  message: z.string(),
  success: z.literal(true)
});

/** @type {import('zod').ZodObject} */
const CreatePostWithImageOutputSchema = z.object({
  postUrn: PostURNSchema,
  imageUrn: ImageURNSchema,
  message: z.string(),
  url: z.string().url()
});

/** @type {import('zod').ZodObject} */
const RefreshTokenOutputSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  message: z.string()
});

/** @type {import('zod').ZodObject} */
const AddCommentOutputSchema = z.object({
  commentUrn: CommentURNSchema,
  postUrn: PostURNSchema,
  message: z.string(),
  success: z.literal(true)
});

/** @type {import('zod').ZodObject} */
const AddReactionOutputSchema = z.object({
  postUrn: PostURNSchema,
  reactionType: ReactionTypeSchema,
  message: z.string(),
  success: z.literal(true)
});

/** @type {import('zod').ZodObject} */
const GetAuthUrlOutputSchema = z.object({
  authUrl: z.string().url(),
  state: z.string(),
  instructions: z.string()
});

/** @type {import('zod').ZodObject} */
const ExchangeCodeOutputSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  personUrn: PersonURNSchema,
  message: z.string()
});

/** @type {import('zod').ZodObject} */
const GetUserInfoOutputSchema = z.object({
  personUrn: PersonURNSchema,
  name: z.string(),
  email: z.string().email(),
  pictureUrl: z.string().url()
});

/** @type {import('zod').ZodObject} */
const SchedulePostOutputSchema = z.object({
  postId: z.string().uuid(),
  scheduledTime: z.string().datetime(),
  status: ScheduledPostStatusSchema,
  message: z.string()
});

/** @type {import('zod').ZodObject} */
const ListScheduledPostsOutputSchema = z.object({
  posts: z.array(ScheduledPostSchema),
  count: z.number().int().min(0),
  message: z.string()
});

/** @type {import('zod').ZodObject} */
const CancelScheduledPostOutputSchema = z.object({
  postId: z.string().uuid(),
  status: z.literal('cancelled'),
  message: z.string(),
  success: z.literal(true)
});

/** @type {import('zod').ZodObject} */
const GetScheduledPostOutputSchema = z.object({
  post: ScheduledPostSchema,
  message: z.string()
});

/** @type {import('zod').ZodObject} */
const CreatePollOutputSchema = z.object({
  postUrn: PostURNSchema,
  message: z.string(),
  url: z.string().url(),
  pollQuestion: z.string(),
  optionCount: z.number().int(),
  duration: PollDurationSchema
});

/** @type {import('zod').ZodObject} */
const CreatePostWithDocumentOutputSchema = z.object({
  postUrn: PostURNSchema,
  documentUrn: DocumentURNSchema,
  message: z.string(),
  url: z.string().url()
});

/** @type {import('zod').ZodObject} */
const CreatePostWithVideoOutputSchema = z.object({
  postUrn: PostURNSchema,
  videoUrn: VideoURNSchema,
  message: z.string(),
  url: z.string().url()
});

/** @type {import('zod').ZodObject} */
const CreatePostWithMultiImagesOutputSchema = z.object({
  postUrn: PostURNSchema,
  imageUrns: z.array(ImageURNSchema),
  message: z.string(),
  url: z.string().url()
});

// ============================================================================
// Error Schemas
// ============================================================================

/** @type {import('zod').ZodObject} */
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().optional(),
  details: z.record(z.any()).optional()
});

/** @type {import('zod').ZodObject} */
const LinkedInAPIErrorSchema = z.object({
  error: z.string(),
  error_description: z.string(),
  status: z.number()
});

// ============================================================================
// Configuration Schemas
// ============================================================================

/** @type {import('zod').ZodObject} */
const OAuthConfigSchema = z.object({
  clientId: z.string().min(1, 'Client ID required'),
  clientSecret: z.string().min(1, 'Client secret required'),
  redirectUri: z.string().url('Invalid redirect URI'),
  scope: z.array(z.string()).min(1, 'At least one scope required')
});

/** @type {import('zod').ZodObject} */
const APIConfigSchema = z.object({
  baseUrl: z.string().url().default('https://api.linkedin.com'),
  version: z.string().regex(/^\d{6}$/, 'Version must be YYYYMM format'),
  accessToken: z.string().min(1, 'Access token required'),
  personId: PersonURNSchema
});

/** @type {import('zod').ZodObject} */
const AppConfigSchema = z.object({
  oauth: OAuthConfigSchema,
  api: APIConfigSchema
});

// ============================================================================
// Utility Schemas
// ============================================================================

/** @type {import('zod').ZodObject} */
const RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(0).default(3),
  initialDelay: z.number().int().min(0).default(1000),
  maxDelay: z.number().int().min(0).default(30000),
  backoffMultiplier: z.number().min(1).default(2)
});

/** @type {import('zod').ZodObject} */
const RetryResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.instanceof(Error).optional(),
  attempts: z.number().int().min(1)
});

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // LinkedIn API schemas
  VisibilitySchema,
  FeedDistributionSchema,
  LifecycleStateSchema,
  PersonURNSchema,
  PostURNSchema,
  ImageURNSchema,
  CommentURNSchema,
  ReactionTypeSchema,
  PollDurationSchema,
  DocumentURNSchema,
  VideoURNSchema,
  DistributionSchema,
  ArticleSchema,
  MediaSchema,
  PostContentSchema,
  LinkedInPostSchema,
  CreatePostResponseSchema,
  PostMetadataSchema,
  PostListSchema,
  UserInfoSchema,
  TokenResponseSchema,

  // MCP tool input schemas
  CreatePostInputSchema,
  CreatePostWithLinkInputSchema,
  GetPostsInputSchema,
  DeletePostInputSchema,
  ExchangeCodeInputSchema,
  UpdatePostInputSchema,
  CreatePostWithImageInputSchema,
  AddCommentInputSchema,
  AddReactionInputSchema,
  SchedulePostInputSchema,
  ListScheduledPostsInputSchema,
  CancelScheduledPostInputSchema,
  GetScheduledPostInputSchema,
  PollOptionSchema,
  CreatePollInputSchema,
  CreatePostWithDocumentInputSchema,
  CreatePostWithVideoInputSchema,
  CreatePostWithMultiImagesInputSchema,

  // MCP tool output schemas
  CreatePostOutputSchema,
  GetPostsOutputSchema,
  DeletePostOutputSchema,
  GetAuthUrlOutputSchema,
  ExchangeCodeOutputSchema,
  GetUserInfoOutputSchema,
  UpdatePostOutputSchema,
  CreatePostWithImageOutputSchema,
  RefreshTokenOutputSchema,
  AddCommentOutputSchema,
  AddReactionOutputSchema,
  SchedulePostOutputSchema,
  ListScheduledPostsOutputSchema,
  CancelScheduledPostOutputSchema,
  GetScheduledPostOutputSchema,
  CreatePollOutputSchema,
  CreatePostWithDocumentOutputSchema,
  CreatePostWithVideoOutputSchema,
  CreatePostWithMultiImagesOutputSchema,

  // Scheduling schemas
  ScheduledPostStatusSchema,
  ScheduledPostSchema,

  // Error schemas
  ErrorResponseSchema,
  LinkedInAPIErrorSchema,

  // Configuration schemas
  OAuthConfigSchema,
  APIConfigSchema,
  AppConfigSchema,

  // Utility schemas
  RetryConfigSchema,
  RetryResultSchema
};
