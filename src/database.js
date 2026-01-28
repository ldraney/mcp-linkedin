/**
 * @fileoverview JSON file-based storage for scheduled LinkedIn posts
 * Replaces SQLite for portability (no native modules)
 * @module database
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {import('./types').ScheduledPost} ScheduledPost
 * @typedef {import('./types').ScheduledPostStatus} ScheduledPostStatus
 */

// Store in user's home directory for persistence across installs
const DEFAULT_DB_PATH = path.join(os.homedir(), '.mcp-linkedin-scheduled-posts.json');

/**
 * JSON-based storage for scheduled posts
 */
class ScheduledPostsDB {
  /**
   * @param {string} [dbPath] - Path to the JSON database file
   */
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.posts = this._load();
  }

  /**
   * Load posts from JSON file
   * @private
   * @returns {Object.<string, Object>} Posts indexed by ID
   */
  _load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Error loading scheduled posts:', err.message);
    }
    return {};
  }

  /**
   * Save posts to JSON file
   * @private
   */
  _save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.posts, null, 2));
    } catch (err) {
      console.error('Error saving scheduled posts:', err.message);
    }
  }

  /**
   * Add a new scheduled post
   * @param {Object} data - Post data
   * @param {string} data.commentary - Post text
   * @param {string} data.scheduledTime - ISO 8601 datetime string
   * @param {string} [data.url] - Optional URL for link posts
   * @param {string} [data.visibility='PUBLIC'] - Post visibility
   * @returns {ScheduledPost} The created scheduled post
   */
  addScheduledPost({ commentary, scheduledTime, url = null, visibility = 'PUBLIC' }) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const post = {
      id,
      commentary,
      url,
      visibility,
      scheduledTime,
      status: 'pending',
      createdAt,
      publishedAt: null,
      postUrn: null,
      errorMessage: null,
      retryCount: 0
    };

    this.posts[id] = post;
    this._save();

    return this._toPost(post);
  }

  /**
   * Get a single scheduled post by ID
   * @param {string} id - Post ID
   * @returns {ScheduledPost|null} The scheduled post or null if not found
   */
  getScheduledPost(id) {
    const post = this.posts[id];
    return post ? this._toPost(post) : null;
  }

  /**
   * Get all scheduled posts, optionally filtered by status
   * @param {ScheduledPostStatus} [status] - Filter by status
   * @param {number} [limit=50] - Maximum number of posts to return
   * @returns {ScheduledPost[]} Array of scheduled posts
   */
  getScheduledPosts(status = null, limit = 50) {
    let posts = Object.values(this.posts);

    if (status) {
      posts = posts.filter(p => p.status === status);
    }

    // Sort by scheduled time ascending
    posts.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

    return posts.slice(0, limit).map(p => this._toPost(p));
  }

  /**
   * Get posts that are due to be published (scheduled time has passed and status is pending)
   * @returns {ScheduledPost[]} Array of posts ready to publish
   */
  getDuePosts() {
    const now = new Date();
    return Object.values(this.posts)
      .filter(p => p.status === 'pending' && new Date(p.scheduledTime) <= now)
      .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
      .map(p => this._toPost(p));
  }

  /**
   * Update post status after successful publish
   * @param {string} id - Post ID
   * @param {string} postUrn - The URN of the published post
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  markAsPublished(id, postUrn) {
    const post = this.posts[id];
    if (!post) return null;

    post.status = 'published';
    post.publishedAt = new Date().toISOString();
    post.postUrn = postUrn;
    this._save();

    return this._toPost(post);
  }

  /**
   * Mark post as failed with error message
   * @param {string} id - Post ID
   * @param {string} errorMessage - Error description
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  markAsFailed(id, errorMessage) {
    const post = this.posts[id];
    if (!post) return null;

    post.status = 'failed';
    post.errorMessage = errorMessage;
    post.retryCount = (post.retryCount || 0) + 1;
    this._save();

    return this._toPost(post);
  }

  /**
   * Cancel a scheduled post
   * @param {string} id - Post ID
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  cancelPost(id) {
    const post = this.posts[id];
    if (!post || post.status !== 'pending') return null;

    post.status = 'cancelled';
    this._save();

    return this._toPost(post);
  }

  /**
   * Delete a scheduled post
   * @param {string} id - Post ID
   * @returns {boolean} True if deleted, false if not found
   */
  deleteScheduledPost(id) {
    if (!this.posts[id]) return false;

    delete this.posts[id];
    this._save();
    return true;
  }

  /**
   * Reset a failed post to pending for retry
   * @param {string} id - Post ID
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  resetForRetry(id) {
    const post = this.posts[id];
    if (!post || post.status !== 'failed') return null;

    post.status = 'pending';
    post.errorMessage = null;
    this._save();

    return this._toPost(post);
  }

  /**
   * Update scheduled time for a pending post
   * @param {string} id - Post ID
   * @param {string} newScheduledTime - New ISO 8601 datetime string
   * @returns {ScheduledPost|null} Updated post or null if not found/not pending
   */
  reschedulePost(id, newScheduledTime) {
    const post = this.posts[id];
    if (!post || post.status !== 'pending') return null;

    post.scheduledTime = newScheduledTime;
    this._save();

    return this._toPost(post);
  }

  /**
   * Convert internal post to ScheduledPost object (ensures consistent casing)
   * @private
   * @param {Object} post - Internal post object
   * @returns {ScheduledPost}
   */
  _toPost(post) {
    return {
      id: post.id,
      commentary: post.commentary,
      url: post.url,
      visibility: post.visibility,
      scheduledTime: post.scheduledTime,
      status: post.status,
      createdAt: post.createdAt,
      publishedAt: post.publishedAt,
      postUrn: post.postUrn,
      errorMessage: post.errorMessage,
      retryCount: post.retryCount || 0
    };
  }

  /**
   * Close the database connection (no-op for JSON, kept for API compatibility)
   */
  close() {
    // No-op for JSON storage
  }
}

// Singleton instance for the application
let dbInstance = null;

/**
 * Get the database instance (creates one if needed)
 * @param {string} [dbPath] - Optional path for testing
 * @returns {ScheduledPostsDB}
 */
function getDatabase(dbPath) {
  if (!dbInstance || dbPath) {
    dbInstance = new ScheduledPostsDB(dbPath);
  }
  return dbInstance;
}

/**
 * Reset the database instance (for testing)
 */
function resetDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  ScheduledPostsDB,
  getDatabase,
  resetDatabase,
  DEFAULT_DB_PATH
};
