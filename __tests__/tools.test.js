/**
 * @file TDD tests for LinkedIn MCP tools
 * Tests use mocked LinkedIn API responses for unit testing
 */

const { z } = require('zod');
const schemas = require('../src/schemas');

// Mock the LinkedIn API module before requiring tools
jest.mock('../src/linkedin-api');
const LinkedInAPI = require('../src/linkedin-api');

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
});
