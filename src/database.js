/**
 * @fileoverview SQLite database wrapper for scheduled LinkedIn posts
 * @module database
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {import('./types').ScheduledPost} ScheduledPost
 * @typedef {import('./types').ScheduledPostStatus} ScheduledPostStatus
 */

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'scheduled_posts.db');

/**
 * Database wrapper for scheduled posts
 */
class ScheduledPostsDB {
  /**
   * @param {string} [dbPath] - Path to the SQLite database file
   */
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this._initializeSchema();
  }

  /**
   * Initialize the database schema
   * @private
   */
  _initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id TEXT PRIMARY KEY,
        commentary TEXT NOT NULL,
        url TEXT,
        visibility TEXT DEFAULT 'PUBLIC',
        scheduled_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        published_at TEXT,
        post_urn TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_status ON scheduled_posts(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_time ON scheduled_posts(scheduled_time);
    `);
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

    const stmt = this.db.prepare(`
      INSERT INTO scheduled_posts (id, commentary, url, visibility, scheduled_time, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `);

    stmt.run(id, commentary, url, visibility, scheduledTime, createdAt);

    return this.getScheduledPost(id);
  }

  /**
   * Get a single scheduled post by ID
   * @param {string} id - Post ID
   * @returns {ScheduledPost|null} The scheduled post or null if not found
   */
  getScheduledPost(id) {
    const stmt = this.db.prepare('SELECT * FROM scheduled_posts WHERE id = ?');
    const row = stmt.get(id);
    return row ? this._rowToPost(row) : null;
  }

  /**
   * Get all scheduled posts, optionally filtered by status
   * @param {ScheduledPostStatus} [status] - Filter by status
   * @param {number} [limit=50] - Maximum number of posts to return
   * @returns {ScheduledPost[]} Array of scheduled posts
   */
  getScheduledPosts(status = null, limit = 50) {
    let stmt;
    if (status) {
      stmt = this.db.prepare(`
        SELECT * FROM scheduled_posts
        WHERE status = ?
        ORDER BY scheduled_time ASC
        LIMIT ?
      `);
      return stmt.all(status, limit).map(row => this._rowToPost(row));
    } else {
      stmt = this.db.prepare(`
        SELECT * FROM scheduled_posts
        ORDER BY scheduled_time ASC
        LIMIT ?
      `);
      return stmt.all(limit).map(row => this._rowToPost(row));
    }
  }

  /**
   * Get posts that are due to be published (scheduled time has passed and status is pending)
   * @returns {ScheduledPost[]} Array of posts ready to publish
   */
  getDuePosts() {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_posts
      WHERE status = 'pending' AND scheduled_time <= ?
      ORDER BY scheduled_time ASC
    `);
    return stmt.all(now).map(row => this._rowToPost(row));
  }

  /**
   * Update post status after successful publish
   * @param {string} id - Post ID
   * @param {string} postUrn - The URN of the published post
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  markAsPublished(id, postUrn) {
    const publishedAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts
      SET status = 'published', published_at = ?, post_urn = ?
      WHERE id = ?
    `);
    stmt.run(publishedAt, postUrn, id);
    return this.getScheduledPost(id);
  }

  /**
   * Mark post as failed with error message
   * @param {string} id - Post ID
   * @param {string} errorMessage - Error description
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  markAsFailed(id, errorMessage) {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts
      SET status = 'failed', error_message = ?, retry_count = retry_count + 1
      WHERE id = ?
    `);
    stmt.run(errorMessage, id);
    return this.getScheduledPost(id);
  }

  /**
   * Cancel a scheduled post
   * @param {string} id - Post ID
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  cancelPost(id) {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts
      SET status = 'cancelled'
      WHERE id = ? AND status = 'pending'
    `);
    const result = stmt.run(id);
    if (result.changes === 0) {
      return null; // Post not found or not in pending status
    }
    return this.getScheduledPost(id);
  }

  /**
   * Delete a scheduled post
   * @param {string} id - Post ID
   * @returns {boolean} True if deleted, false if not found
   */
  deleteScheduledPost(id) {
    const stmt = this.db.prepare('DELETE FROM scheduled_posts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Reset a failed post to pending for retry
   * @param {string} id - Post ID
   * @returns {ScheduledPost|null} Updated post or null if not found
   */
  resetForRetry(id) {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts
      SET status = 'pending', error_message = NULL
      WHERE id = ? AND status = 'failed'
    `);
    const result = stmt.run(id);
    if (result.changes === 0) {
      return null;
    }
    return this.getScheduledPost(id);
  }

  /**
   * Update scheduled time for a pending post
   * @param {string} id - Post ID
   * @param {string} newScheduledTime - New ISO 8601 datetime string
   * @returns {ScheduledPost|null} Updated post or null if not found/not pending
   */
  reschedulePost(id, newScheduledTime) {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts
      SET scheduled_time = ?
      WHERE id = ? AND status = 'pending'
    `);
    const result = stmt.run(newScheduledTime, id);
    if (result.changes === 0) {
      return null;
    }
    return this.getScheduledPost(id);
  }

  /**
   * Convert database row to ScheduledPost object
   * @private
   * @param {Object} row - Database row
   * @returns {ScheduledPost}
   */
  _rowToPost(row) {
    return {
      id: row.id,
      commentary: row.commentary,
      url: row.url,
      visibility: row.visibility,
      scheduledTime: row.scheduled_time,
      status: row.status,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      postUrn: row.post_urn,
      errorMessage: row.error_message,
      retryCount: row.retry_count
    };
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
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
