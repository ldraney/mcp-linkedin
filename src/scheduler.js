#!/usr/bin/env node

/**
 * @fileoverview Background scheduler daemon for LinkedIn posts
 * Checks for due posts every minute and publishes them
 */

require('dotenv').config();
const cron = require('node-cron');
const { getDatabase } = require('./database');
const LinkedInAPI = require('./linkedin-api');

/**
 * @typedef {import('./types').ScheduledPost} ScheduledPost
 */

const MAX_RETRIES = 3;

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
 * Publish a scheduled post to LinkedIn
 * @param {ScheduledPost} scheduledPost - The post to publish
 * @returns {Promise<{success: boolean, postUrn?: string, error?: string}>}
 */
async function publishPost(scheduledPost) {
  try {
    const api = getAPIClient();

    const postData = {
      author: `urn:li:person:${process.env.LINKEDIN_PERSON_ID}`,
      commentary: scheduledPost.commentary,
      visibility: scheduledPost.visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED'
      },
      lifecycleState: 'PUBLISHED'
    };

    // If URL is provided, create a link post
    if (scheduledPost.url) {
      postData.content = {
        article: {
          source: scheduledPost.url
        }
      };
    }

    const result = await api.createPost(postData);

    return {
      success: true,
      postUrn: result.postUrn
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error during publish'
    };
  }
}

/**
 * Process all due posts
 * @returns {Promise<{published: number, failed: number}>}
 */
async function processDuePosts() {
  const db = getDatabase();
  const duePosts = db.getDuePosts();

  let published = 0;
  let failed = 0;

  for (const post of duePosts) {
    console.log(`[${new Date().toISOString()}] Processing scheduled post: ${post.id}`);
    console.log(`  Commentary: ${post.commentary.substring(0, 50)}...`);

    const result = await publishPost(post);

    if (result.success) {
      db.markAsPublished(post.id, result.postUrn);
      console.log(`  ✓ Published successfully: ${result.postUrn}`);
      published++;
    } else {
      db.markAsFailed(post.id, result.error);
      console.log(`  ✗ Failed: ${result.error} (attempt ${post.retryCount + 1})`);

      // Check if we should retry
      if (post.retryCount + 1 < MAX_RETRIES) {
        console.log(`  Will retry on next cycle`);
        // Reset to pending for retry
        db.resetForRetry(post.id);
      } else {
        console.log(`  Max retries reached, marked as failed`);
      }
      failed++;
    }
  }

  return { published, failed };
}

/**
 * Start the scheduler
 * @param {string} [cronExpression='* * * * *'] - Cron expression (default: every minute)
 */
function startScheduler(cronExpression = '* * * * *') {
  console.log(`[${new Date().toISOString()}] LinkedIn Post Scheduler Started`);
  console.log(`  Cron expression: ${cronExpression}`);
  console.log(`  Access token configured: ${!!process.env.LINKEDIN_ACCESS_TOKEN}`);
  console.log(`  Person ID configured: ${!!process.env.LINKEDIN_PERSON_ID}`);
  console.log('');

  // Initial check on startup
  console.log('Running initial check...');
  processDuePosts().then(({ published, failed }) => {
    if (published > 0 || failed > 0) {
      console.log(`Initial check: ${published} published, ${failed} failed`);
    } else {
      console.log('No posts due at startup');
    }
    console.log('');
  });

  // Schedule regular checks
  const task = cron.schedule(cronExpression, async () => {
    const timestamp = new Date().toISOString();
    const db = getDatabase();
    const pendingCount = db.getScheduledPosts('pending', 100).length;

    if (pendingCount > 0) {
      console.log(`[${timestamp}] Checking for due posts (${pendingCount} pending)...`);
      const { published, failed } = await processDuePosts();
      if (published > 0 || failed > 0) {
        console.log(`  Results: ${published} published, ${failed} failed`);
      }
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down scheduler...');
    task.stop();
    const db = getDatabase();
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down scheduler...');
    task.stop();
    const db = getDatabase();
    db.close();
    process.exit(0);
  });

  return task;
}

/**
 * CLI entry point
 */
function main() {
  // Check required environment variables
  if (!process.env.LINKEDIN_ACCESS_TOKEN) {
    console.error('Error: LINKEDIN_ACCESS_TOKEN not set in environment');
    process.exit(1);
  }

  if (!process.env.LINKEDIN_PERSON_ID) {
    console.error('Error: LINKEDIN_PERSON_ID not set in environment');
    process.exit(1);
  }

  // Allow custom cron expression via CLI argument
  const cronExpression = process.argv[2] || '* * * * *';

  startScheduler(cronExpression);
}

// Export for testing
module.exports = {
  publishPost,
  processDuePosts,
  startScheduler
};

// Run if called directly
if (require.main === module) {
  main();
}
