/**
 * @file Tests for token storage module
 * Tests the OS keychain credential storage functionality
 */

// Mock @napi-rs/keyring before requiring the module
const mockSetPassword = jest.fn();
const mockGetPassword = jest.fn();
const mockDeletePassword = jest.fn();

jest.mock('@napi-rs/keyring', () => ({
  Entry: jest.fn().mockImplementation(() => ({
    setPassword: mockSetPassword,
    getPassword: mockGetPassword,
    deletePassword: mockDeletePassword
  }))
}));

const { Entry } = require('@napi-rs/keyring');
const {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  hasCredentials
} = require('../../src/auth/token-storage');

describe('Token Storage Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeCredentials', () => {
    it('should store credentials as JSON in keychain', () => {
      const credentials = {
        accessToken: 'test-token-123',
        personId: 'test-person-456',
        refreshToken: 'refresh-789',
        expiresAt: Date.now() + 3600000
      };

      storeCredentials(credentials);

      expect(Entry).toHaveBeenCalledWith('mcp-linkedin', 'oauth-credentials');
      expect(mockSetPassword).toHaveBeenCalledWith(JSON.stringify(credentials));
    });

    it('should store minimal credentials', () => {
      const credentials = {
        accessToken: 'test-token',
        personId: 'test-person'
      };

      storeCredentials(credentials);

      expect(mockSetPassword).toHaveBeenCalledWith(JSON.stringify(credentials));
    });
  });

  describe('getCredentials', () => {
    it('should retrieve and parse credentials from keychain', () => {
      const storedData = {
        accessToken: 'stored-token',
        personId: 'stored-person',
        refreshToken: null,
        expiresAt: null
      };
      mockGetPassword.mockReturnValue(JSON.stringify(storedData));

      const result = getCredentials();

      expect(Entry).toHaveBeenCalledWith('mcp-linkedin', 'oauth-credentials');
      expect(result).toEqual(storedData);
    });

    it('should return null when no credentials stored', () => {
      mockGetPassword.mockReturnValue(null);

      const result = getCredentials();

      expect(result).toBeNull();
    });

    it('should return null on keychain access error', () => {
      mockGetPassword.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = getCredentials();

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      mockGetPassword.mockReturnValue('');

      const result = getCredentials();

      expect(result).toBeNull();
    });
  });

  describe('deleteCredentials', () => {
    it('should delete credentials from keychain', () => {
      mockDeletePassword.mockReturnValue(undefined);

      const result = deleteCredentials();

      expect(Entry).toHaveBeenCalledWith('mcp-linkedin', 'oauth-credentials');
      expect(mockDeletePassword).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when credentials not found', () => {
      mockDeletePassword.mockImplementation(() => {
        throw new Error('Item not found');
      });

      const result = deleteCredentials();

      expect(result).toBe(false);
    });
  });

  describe('hasCredentials', () => {
    it('should return true when credentials exist', () => {
      mockGetPassword.mockReturnValue(JSON.stringify({ accessToken: 'test' }));

      const result = hasCredentials();

      expect(result).toBe(true);
    });

    it('should return false when no credentials', () => {
      mockGetPassword.mockReturnValue(null);

      const result = hasCredentials();

      expect(result).toBe(false);
    });
  });
});
