/**
 * @file TDD tests for LinkedIn MCP tools
 * Tests use mocked LinkedIn API responses for unit testing
 */

const { z } = require('zod');
const schemas = require('../src/schemas');

// Mock the LinkedIn API module before requiring tools
jest.mock('../src/linkedin-api');
const LinkedInAPI = require('../src/linkedin-api');

// Mock the database module
jest.mock('../src/database');

// Mock environment variables
process.env.LINKEDIN_CLIENT_ID = 'test_client_id';
process.env.LINKEDIN_CLIENT_SECRET = 'test_secret';
process.env.LINKEDIN_REDIRECT_URI = 'https://localhost:3000/callback';
process.env.LINKEDIN_ACCESS_TOKEN = 'test_access_token';
process.env.LINKEDIN_PERSON_ID = 't-testPersonId';
process.env.LINKEDIN_API_VERSION = '202510';

describe('LinkedIn MCP Tools - TDD', () => {
  let tools;

  beforeAll(async () => {
    tools = require('../src/tools');
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('linkedin_create_post', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        commentary: 'Test post #testing',
        visibility: 'PUBLIC'
      };

      const result = schemas.CreatePostInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty commentary', () => {
      const invalidInput = {
        commentary: '',
        visibility: 'PUBLIC'
      };

      const result = schemas.CreatePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('cannot be empty');
    });

    it('should reject commentary over 3000 characters', () => {
      const invalidInput = {
        commentary: 'a'.repeat(3001),
        visibility: 'PUBLIC'
      };

      const result = schemas.CreatePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should use PUBLIC as default visibility', () => {
      const input = { commentary: 'Test' };
      const parsed = schemas.CreatePostInputSchema.parse(input);
      expect(parsed.visibility).toBe('PUBLIC');
    });

    it('should return CreatePostOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.createPost = jest.fn().mockResolvedValue({
        postUrn: 'urn:li:share:123456789',
        statusCode: 201
      });

      const input = {
        commentary: 'Test post',
        visibility: 'PUBLIC'
      };

      const result = await tools.linkedin_create_post(input);

      // Validate output matches schema
      const validation = schemas.CreatePostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      // Check required fields
      expect(result).toHaveProperty('postUrn');
      expect(result).toHaveProperty('message');
      expect(result.postUrn).toMatch(/^urn:li:(share|ugcPost):.+$/);
    });
  });

  describe('linkedin_create_post_with_link', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        commentary: 'Check out my project!',
        url: 'https://github.com/ldraney/mcp-linkedin',
        title: 'MCP LinkedIn',
        description: 'Automate LinkedIn posts',
        visibility: 'PUBLIC'
      };

      const result = schemas.CreatePostWithLinkInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalidInput = {
        commentary: 'Test',
        url: 'not-a-url'
      };

      const result = schemas.CreatePostWithLinkInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Invalid URL');
    });

    it('should allow optional title and description', () => {
      const input = {
        commentary: 'Test',
        url: 'https://example.com'
      };

      const parsed = schemas.CreatePostWithLinkInputSchema.parse(input);
      expect(parsed.title).toBeUndefined();
      expect(parsed.description).toBeUndefined();
    });

    it('should return CreatePostOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.createPost = jest.fn().mockResolvedValue({
        postUrn: 'urn:li:share:987654321',
        statusCode: 201
      });

      const input = {
        commentary: 'Test link post',
        url: 'https://github.com/ldraney/test',
        title: 'Test Project'
      };

      const result = await tools.linkedin_create_post_with_link(input);

      const validation = schemas.CreatePostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);
      expect(result.postUrn).toMatch(/^urn:li:(share|ugcPost):.+$/);
    });
  });

  describe('linkedin_get_my_posts', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        limit: 20,
        offset: 10
      };

      const result = schemas.GetPostsInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should use defaults for limit and offset', () => {
      const input = {};
      const parsed = schemas.GetPostsInputSchema.parse(input);
      expect(parsed.limit).toBe(10);
      expect(parsed.offset).toBe(0);
    });

    it('should reject limit over 100', () => {
      const invalidInput = { limit: 101 };
      const result = schemas.GetPostsInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const invalidInput = { offset: -1 };
      const result = schemas.GetPostsInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return GetPostsOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.getPosts = jest.fn().mockResolvedValue({
        elements: [
          {
            id: 'urn:li:share:111',
            author: 'urn:li:person:test',
            commentary: 'Test post 1',
            visibility: 'PUBLIC',
            created: { time: Date.now() },
            lifecycleState: 'PUBLISHED'
          },
          {
            id: 'urn:li:share:222',
            author: 'urn:li:person:test',
            commentary: 'Test post 2',
            visibility: 'PUBLIC',
            created: { time: Date.now() },
            lifecycleState: 'PUBLISHED'
          }
        ],
        paging: {
          count: 2,
          start: 0,
          total: 10
        }
      });

      const input = { limit: 5, offset: 0 };
      const result = await tools.linkedin_get_my_posts(input);

      const validation = schemas.GetPostsOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('posts');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('offset');
      expect(result).toHaveProperty('hasMore');
      expect(Array.isArray(result.posts)).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('linkedin_delete_post', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        postUrn: 'urn:li:share:123456'
      };

      const result = schemas.DeletePostInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URN format', () => {
      const invalidInput = {
        postUrn: 'not-a-valid-urn'
      };

      const result = schemas.DeletePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept ugcPost URN format', () => {
      const input = {
        postUrn: 'urn:li:ugcPost:7393762149422116864'
      };

      const result = schemas.DeletePostInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should return DeletePostOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.deletePost = jest.fn().mockResolvedValue({
        statusCode: 204
      });

      const input = {
        postUrn: 'urn:li:share:123456'
      };

      const result = await tools.linkedin_delete_post(input);

      const validation = schemas.DeletePostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result.postUrn).toBe(input.postUrn);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
    });
  });

  describe('linkedin_get_auth_url', () => {
    it('should return GetAuthUrlOutput', async () => {
      const result = await tools.linkedin_get_auth_url();

      const validation = schemas.GetAuthUrlOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('instructions');
      expect(result.authUrl).toContain('linkedin.com/oauth');
    });

    it('should include required OAuth parameters in URL', async () => {
      const result = await tools.linkedin_get_auth_url();

      const url = new URL(result.authUrl);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('test_client_id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://localhost:3000/callback');
      expect(url.searchParams.get('scope')).toContain('w_member_social');
    });
  });

  describe('linkedin_exchange_code', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        authorizationCode: 'AQR9vB6le8nKxBv1i7TeA_test'
      };

      const result = schemas.ExchangeCodeInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty authorization code', () => {
      const invalidInput = {
        authorizationCode: ''
      };

      const result = schemas.ExchangeCodeInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return ExchangeCodeOutput on success', async () => {
      // Mock static method and getUserInfo
      LinkedInAPI.exchangeAuthCode = jest.fn().mockResolvedValue({
        access_token: 'mock_access_token',
        expires_in: 5184000,
        scope: 'openid profile email w_member_social',
        token_type: 'Bearer'
      });

      LinkedInAPI.prototype.getUserInfo = jest.fn().mockResolvedValue({
        sub: 'mock-person-id',
        name: 'Test User',
        email: 'test@example.com',
        picture: 'https://example.com/pic.jpg'
      });

      const input = {
        authorizationCode: 'test_auth_code_12345'
      };

      const result = await tools.linkedin_exchange_code(input);

      const validation = schemas.ExchangeCodeOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('personUrn');
      expect(result).toHaveProperty('message');
      expect(result.personUrn).toMatch(/^urn:li:person:.+$/);
    });
  });

  describe('linkedin_get_user_info', () => {
    it('should return GetUserInfoOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.getUserInfo = jest.fn().mockResolvedValue({
        sub: 'test-person-id',
        name: 'Test User',
        email: 'test@example.com',
        picture: 'https://example.com/picture.jpg'
      });

      const result = await tools.linkedin_get_user_info();

      const validation = schemas.GetUserInfoOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('personUrn');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('pictureUrl');
      expect(result.personUrn).toMatch(/^urn:li:person:.+$/);
    });
  });

  describe('linkedin_update_post', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        postUrn: 'urn:li:share:123456',
        commentary: 'Updated post text'
      };

      const result = schemas.UpdatePostInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URN format', () => {
      const invalidInput = {
        postUrn: 'not-a-valid-urn',
        commentary: 'Test'
      };

      const result = schemas.UpdatePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should require at least one field to update', () => {
      const invalidInput = {
        postUrn: 'urn:li:share:123456'
      };

      const result = schemas.UpdatePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('At least one field');
    });

    it('should accept only commentary update', () => {
      const input = {
        postUrn: 'urn:li:share:123456',
        commentary: 'New text'
      };

      const result = schemas.UpdatePostInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept only contentLandingPage update', () => {
      const input = {
        postUrn: 'urn:li:share:123456',
        contentLandingPage: 'https://example.com/new-page'
      };

      const result = schemas.UpdatePostInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject commentary over 3000 characters', () => {
      const invalidInput = {
        postUrn: 'urn:li:share:123456',
        commentary: 'a'.repeat(3001)
      };

      const result = schemas.UpdatePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return UpdatePostOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.updatePost = jest.fn().mockResolvedValue({
        statusCode: 200
      });

      const input = {
        postUrn: 'urn:li:share:123456',
        commentary: 'Updated post text'
      };

      const result = await tools.linkedin_update_post(input);

      const validation = schemas.UpdatePostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result.postUrn).toBe(input.postUrn);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
    });
  });

  describe('linkedin_create_post_with_image', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        commentary: 'Check out this image!',
        imagePath: '/path/to/image.png',
        altText: 'A beautiful image',
        visibility: 'PUBLIC'
      };

      const result = schemas.CreatePostWithImageInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty commentary', () => {
      const invalidInput = {
        commentary: '',
        imagePath: '/path/to/image.png'
      };

      const result = schemas.CreatePostWithImageInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('cannot be empty');
    });

    it('should reject empty imagePath', () => {
      const invalidInput = {
        commentary: 'Test post',
        imagePath: ''
      };

      const result = schemas.CreatePostWithImageInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should use PUBLIC as default visibility', () => {
      const input = {
        commentary: 'Test',
        imagePath: '/path/to/image.jpg'
      };
      const parsed = schemas.CreatePostWithImageInputSchema.parse(input);
      expect(parsed.visibility).toBe('PUBLIC');
    });

    it('should allow optional altText', () => {
      const input = {
        commentary: 'Test',
        imagePath: '/path/to/image.png'
      };

      const parsed = schemas.CreatePostWithImageInputSchema.parse(input);
      expect(parsed.altText).toBeUndefined();
    });

    it('should reject altText over 300 characters', () => {
      const invalidInput = {
        commentary: 'Test',
        imagePath: '/path/to/image.png',
        altText: 'a'.repeat(301)
      };

      const result = schemas.CreatePostWithImageInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('linkedin_refresh_token', () => {
    it('should return RefreshTokenOutput on success', async () => {
      // Mock static method
      LinkedInAPI.refreshAccessToken = jest.fn().mockResolvedValue({
        access_token: 'new_access_token',
        expires_in: 5184000,
        scope: 'openid profile email w_member_social',
        token_type: 'Bearer'
      });

      const input = {
        refreshToken: 'test_refresh_token'
      };

      const result = await tools.linkedin_refresh_token(input);

      const validation = schemas.RefreshTokenOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('message');
      expect(result.accessToken).toBe('new_access_token');
    });

    it('should throw error when refresh token is missing', async () => {
      const input = {};

      await expect(tools.linkedin_refresh_token(input)).rejects.toThrow('Refresh token is required');
    });
  });

  describe('linkedin_add_comment', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        postUrn: 'urn:li:share:123456',
        text: 'Great post!'
      };

      const result = schemas.AddCommentInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URN format', () => {
      const invalidInput = {
        postUrn: 'not-a-valid-urn',
        text: 'Test comment'
      };

      const result = schemas.AddCommentInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept ugcPost URN format', () => {
      const input = {
        postUrn: 'urn:li:ugcPost:7393762149422116864',
        text: 'Nice!'
      };

      const result = schemas.AddCommentInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty comment text', () => {
      const invalidInput = {
        postUrn: 'urn:li:share:123456',
        text: ''
      };

      const result = schemas.AddCommentInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('cannot be empty');
    });

    it('should reject comment text over 1250 characters', () => {
      const invalidInput = {
        postUrn: 'urn:li:share:123456',
        text: 'a'.repeat(1251)
      };

      const result = schemas.AddCommentInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return AddCommentOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.addComment = jest.fn().mockResolvedValue({
        commentUrn: 'urn:li:comment:(urn:li:share:123456,789)',
        statusCode: 201
      });

      const input = {
        postUrn: 'urn:li:share:123456',
        text: 'Great post!'
      };

      const result = await tools.linkedin_add_comment(input);

      const validation = schemas.AddCommentOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result.commentUrn).toBe('urn:li:comment:(urn:li:share:123456,789)');
      expect(result.postUrn).toBe(input.postUrn);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
    });
  });

  describe('linkedin_add_reaction', () => {
    it('should validate input with Zod schema', () => {
      const validInput = {
        postUrn: 'urn:li:share:123456',
        reactionType: 'LIKE'
      };

      const result = schemas.AddReactionInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URN format', () => {
      const invalidInput = {
        postUrn: 'not-a-valid-urn',
        reactionType: 'LIKE'
      };

      const result = schemas.AddReactionInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should accept all valid reaction types', () => {
      const reactionTypes = ['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'];

      reactionTypes.forEach(reactionType => {
        const input = {
          postUrn: 'urn:li:share:123456',
          reactionType
        };

        const result = schemas.AddReactionInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid reaction type', () => {
      const invalidInput = {
        postUrn: 'urn:li:share:123456',
        reactionType: 'INVALID_TYPE'
      };

      const result = schemas.AddReactionInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return AddReactionOutput on success', async () => {
      // Mock API response
      LinkedInAPI.prototype.addReaction = jest.fn().mockResolvedValue({
        statusCode: 201
      });

      const input = {
        postUrn: 'urn:li:share:123456',
        reactionType: 'PRAISE'
      };

      const result = await tools.linkedin_add_reaction(input);

      const validation = schemas.AddReactionOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result.postUrn).toBe(input.postUrn);
      expect(result.reactionType).toBe('PRAISE');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('PRAISE');
    });
  });

  // ============================================================================
  // Scheduling Tools Tests
  // ============================================================================

  describe('linkedin_schedule_post', () => {
    const { getDatabase } = require('../src/database');

    beforeEach(() => {
      // Reset mock for each test
      getDatabase.mockReturnValue({
        addScheduledPost: jest.fn().mockReturnValue({
          id: '123e4567-e89b-12d3-a456-426614174000',
          commentary: 'Scheduled test post',
          url: null,
          visibility: 'PUBLIC',
          scheduledTime: '2030-01-15T09:00:00.000Z',
          status: 'pending',
          createdAt: new Date().toISOString(),
          publishedAt: null,
          postUrn: null,
          errorMessage: null,
          retryCount: 0
        })
      });
    });

    it('should validate input with Zod schema', () => {
      const validInput = {
        commentary: 'Scheduled post #testing',
        scheduledTime: '2030-01-15T09:00:00Z',
        visibility: 'PUBLIC'
      };

      const result = schemas.SchedulePostInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject empty commentary', () => {
      const invalidInput = {
        commentary: '',
        scheduledTime: '2030-01-15T09:00:00Z'
      };

      const result = schemas.SchedulePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('cannot be empty');
    });

    it('should reject scheduledTime in the past', () => {
      const invalidInput = {
        commentary: 'Test post',
        scheduledTime: '2020-01-15T09:00:00Z'
      };

      const result = schemas.SchedulePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('must be in the future');
    });

    it('should reject invalid datetime format', () => {
      const invalidInput = {
        commentary: 'Test post',
        scheduledTime: 'not-a-date'
      };

      const result = schemas.SchedulePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should use PUBLIC as default visibility', () => {
      const input = {
        commentary: 'Test',
        scheduledTime: '2030-01-15T09:00:00Z'
      };
      const parsed = schemas.SchedulePostInputSchema.parse(input);
      expect(parsed.visibility).toBe('PUBLIC');
    });

    it('should allow optional URL', () => {
      const input = {
        commentary: 'Check this out!',
        scheduledTime: '2030-01-15T09:00:00Z',
        url: 'https://github.com/test/project'
      };

      const result = schemas.SchedulePostInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL format', () => {
      const invalidInput = {
        commentary: 'Test',
        scheduledTime: '2030-01-15T09:00:00Z',
        url: 'not-a-url'
      };

      const result = schemas.SchedulePostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return SchedulePostOutput on success', async () => {
      const input = {
        commentary: 'Scheduled test post',
        scheduledTime: '2030-01-15T09:00:00Z',
        visibility: 'PUBLIC'
      };

      const result = await tools.linkedin_schedule_post(input);

      const validation = schemas.SchedulePostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('postId');
      expect(result).toHaveProperty('scheduledTime');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result.status).toBe('pending');
    });
  });

  describe('linkedin_list_scheduled_posts', () => {
    const { getDatabase } = require('../src/database');

    beforeEach(() => {
      getDatabase.mockReturnValue({
        getScheduledPosts: jest.fn().mockReturnValue([
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            commentary: 'Scheduled post 1',
            url: null,
            visibility: 'PUBLIC',
            scheduledTime: '2030-01-15T09:00:00.000Z',
            status: 'pending',
            createdAt: new Date().toISOString(),
            publishedAt: null,
            postUrn: null,
            errorMessage: null,
            retryCount: 0
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174001',
            commentary: 'Scheduled post 2',
            url: 'https://example.com',
            visibility: 'PUBLIC',
            scheduledTime: '2030-01-16T10:00:00.000Z',
            status: 'pending',
            createdAt: new Date().toISOString(),
            publishedAt: null,
            postUrn: null,
            errorMessage: null,
            retryCount: 0
          }
        ])
      });
    });

    it('should validate input with Zod schema', () => {
      const validInput = {
        status: 'pending',
        limit: 50
      };

      const result = schemas.ListScheduledPostsInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should use default limit of 50', () => {
      const input = {};
      const parsed = schemas.ListScheduledPostsInputSchema.parse(input);
      expect(parsed.limit).toBe(50);
    });

    it('should accept all valid status values', () => {
      const statuses = ['pending', 'published', 'failed', 'cancelled'];

      statuses.forEach(status => {
        const input = { status };
        const result = schemas.ListScheduledPostsInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status', () => {
      const invalidInput = { status: 'invalid' };
      const result = schemas.ListScheduledPostsInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const invalidInput = { limit: 101 };
      const result = schemas.ListScheduledPostsInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return ListScheduledPostsOutput on success', async () => {
      const input = { limit: 10 };

      const result = await tools.linkedin_list_scheduled_posts(input);

      const validation = schemas.ListScheduledPostsOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('posts');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('message');
      expect(Array.isArray(result.posts)).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('linkedin_cancel_scheduled_post', () => {
    const { getDatabase } = require('../src/database');

    beforeEach(() => {
      getDatabase.mockReturnValue({
        cancelPost: jest.fn().mockReturnValue({
          id: '123e4567-e89b-12d3-a456-426614174000',
          commentary: 'Cancelled post',
          url: null,
          visibility: 'PUBLIC',
          scheduledTime: '2030-01-15T09:00:00.000Z',
          status: 'cancelled',
          createdAt: new Date().toISOString(),
          publishedAt: null,
          postUrn: null,
          errorMessage: null,
          retryCount: 0
        })
      });
    });

    it('should validate input with Zod schema', () => {
      const validInput = {
        postId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = schemas.CancelScheduledPostInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const invalidInput = {
        postId: 'not-a-uuid'
      };

      const result = schemas.CancelScheduledPostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('Invalid');
    });

    it('should return CancelScheduledPostOutput on success', async () => {
      const input = {
        postId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = await tools.linkedin_cancel_scheduled_post(input);

      const validation = schemas.CancelScheduledPostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result.postId).toBe(input.postId);
      expect(result.status).toBe('cancelled');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
    });

    it('should throw error when post not found or not pending', async () => {
      getDatabase.mockReturnValue({
        cancelPost: jest.fn().mockReturnValue(null)
      });

      const input = {
        postId: '123e4567-e89b-12d3-a456-426614174000'
      };

      await expect(tools.linkedin_cancel_scheduled_post(input))
        .rejects.toThrow('Post not found or not in pending status');
    });
  });

  describe('linkedin_get_scheduled_post', () => {
    const { getDatabase } = require('../src/database');

    beforeEach(() => {
      getDatabase.mockReturnValue({
        getScheduledPost: jest.fn().mockReturnValue({
          id: '123e4567-e89b-12d3-a456-426614174000',
          commentary: 'Test scheduled post',
          url: null,
          visibility: 'PUBLIC',
          scheduledTime: '2030-01-15T09:00:00.000Z',
          status: 'pending',
          createdAt: new Date().toISOString(),
          publishedAt: null,
          postUrn: null,
          errorMessage: null,
          retryCount: 0
        })
      });
    });

    it('should validate input with Zod schema', () => {
      const validInput = {
        postId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = schemas.GetScheduledPostInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const invalidInput = {
        postId: 'invalid-uuid'
      };

      const result = schemas.GetScheduledPostInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should return GetScheduledPostOutput on success', async () => {
      const input = {
        postId: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = await tools.linkedin_get_scheduled_post(input);

      const validation = schemas.GetScheduledPostOutputSchema.safeParse(result);
      expect(validation.success).toBe(true);

      expect(result).toHaveProperty('post');
      expect(result).toHaveProperty('message');
      expect(result.post.id).toBe(input.postId);
    });

    it('should throw error when post not found', async () => {
      getDatabase.mockReturnValue({
        getScheduledPost: jest.fn().mockReturnValue(null)
      });

      const input = {
        postId: '123e4567-e89b-12d3-a456-426614174000'
      };

      await expect(tools.linkedin_get_scheduled_post(input))
        .rejects.toThrow('Scheduled post not found');
    });
  });
});
