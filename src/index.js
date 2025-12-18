#!/usr/bin/env node

/**
 * @file MCP Server for LinkedIn
 * Provides tools for creating, managing, and scheduling LinkedIn posts
 */

require('dotenv').config();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const tools = require('./tools');
const schemas = require('./schemas');

/**
 * MCP Server instance
 */
const server = new Server(
  {
    name: 'mcp-linkedin',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

/**
 * Tool definitions for MCP
 */
const TOOL_DEFINITIONS = [
  {
    name: 'linkedin_create_post',
    description: 'Create a simple text post on LinkedIn. Supports hashtags and mentions.',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters). Supports hashtags (#tag) and mentions.'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary']
    }
  },
  {
    name: 'linkedin_create_post_with_link',
    description: 'Create a LinkedIn post with a link preview (article, GitHub repo, blog post, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters)'
        },
        url: {
          type: 'string',
          description: 'URL to link (GitHub repo, blog post, article, etc.)'
        },
        title: {
          type: 'string',
          description: 'Custom title for link preview (optional, overrides auto-scraped title)'
        },
        description: {
          type: 'string',
          description: 'Custom description for link preview (optional)'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary', 'url']
    }
  },
  {
    name: 'linkedin_get_my_posts',
    description: 'Retrieve your recent LinkedIn posts with pagination support',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of posts to retrieve (1-100)',
          default: 10,
          minimum: 1,
          maximum: 100
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (skip this many posts)',
          default: 0,
          minimum: 0
        }
      }
    }
  },
  {
    name: 'linkedin_delete_post',
    description: 'Delete a LinkedIn post by its URN. This operation is idempotent.',
    inputSchema: {
      type: 'object',
      properties: {
        postUrn: {
          type: 'string',
          description: 'Post URN (e.g., "urn:li:share:123456" or "urn:li:ugcPost:789")'
        }
      },
      required: ['postUrn']
    }
  },
  {
    name: 'linkedin_get_auth_url',
    description: 'Generate OAuth authorization URL for LinkedIn. User must visit this URL to authorize the app.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'linkedin_exchange_code',
    description: 'Exchange OAuth authorization code for access token. Call this after user authorizes the app.',
    inputSchema: {
      type: 'object',
      properties: {
        authorizationCode: {
          type: 'string',
          description: 'Authorization code from OAuth callback URL'
        }
      },
      required: ['authorizationCode']
    }
  },
  {
    name: 'linkedin_get_user_info',
    description: 'Get current authenticated user\'s LinkedIn profile information',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'linkedin_update_post',
    description: 'Update an existing LinkedIn post. Can modify commentary, CTA label, or landing page URL.',
    inputSchema: {
      type: 'object',
      properties: {
        postUrn: {
          type: 'string',
          description: 'Post URN to update (e.g., "urn:li:share:123456")'
        },
        commentary: {
          type: 'string',
          description: 'New post text (max 3000 characters)'
        },
        contentCallToActionLabel: {
          type: 'string',
          description: 'New call-to-action label'
        },
        contentLandingPage: {
          type: 'string',
          description: 'New landing page URL'
        }
      },
      required: ['postUrn']
    }
  },
  {
    name: 'linkedin_create_post_with_image',
    description: 'Create a LinkedIn post with an uploaded image. Supports PNG, JPG, and GIF formats.',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters)'
        },
        imagePath: {
          type: 'string',
          description: 'Local file path to the image (PNG, JPG, or GIF)'
        },
        altText: {
          type: 'string',
          description: 'Accessibility text for the image (max 300 characters)'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary', 'imagePath']
    }
  },
  {
    name: 'linkedin_refresh_token',
    description: 'Refresh an expired access token using a refresh token. LinkedIn tokens expire after 60 days.',
    inputSchema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'The refresh token obtained during initial OAuth flow'
        }
      },
      required: ['refreshToken']
    }
  },
  {
    name: 'linkedin_add_comment',
    description: 'Add a comment to a LinkedIn post. Comments support up to 1250 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        postUrn: {
          type: 'string',
          description: 'Post URN to comment on (e.g., "urn:li:share:123456" or "urn:li:ugcPost:789")'
        },
        text: {
          type: 'string',
          description: 'Comment text (max 1250 characters)'
        }
      },
      required: ['postUrn', 'text']
    }
  },
  {
    name: 'linkedin_add_reaction',
    description: 'Add a reaction to a LinkedIn post. Reaction types: LIKE (thumbs up), PRAISE (celebrate), EMPATHY (love), INTEREST (insightful), APPRECIATION (support), ENTERTAINMENT (funny).',
    inputSchema: {
      type: 'object',
      properties: {
        postUrn: {
          type: 'string',
          description: 'Post URN to react to (e.g., "urn:li:share:123456" or "urn:li:ugcPost:789")'
        },
        reactionType: {
          type: 'string',
          enum: ['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'],
          description: 'Type of reaction: LIKE (thumbs up), PRAISE (celebrate), EMPATHY (love), INTEREST (insightful), APPRECIATION (support), ENTERTAINMENT (funny)'
        }
      },
      required: ['postUrn', 'reactionType']
    }
  },
  // Scheduling tools
  {
    name: 'linkedin_schedule_post',
    description: 'Schedule a LinkedIn post for future publication. The post will be stored locally and published by the scheduler daemon when the scheduled time arrives.',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters). Supports hashtags (#tag) and mentions.'
        },
        scheduledTime: {
          type: 'string',
          description: 'ISO 8601 datetime for when to publish (must be in the future). Example: "2025-01-15T09:00:00Z"'
        },
        url: {
          type: 'string',
          description: 'Optional URL to include with link preview (for link posts)'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary', 'scheduledTime']
    }
  },
  {
    name: 'linkedin_list_scheduled_posts',
    description: 'List all scheduled posts, optionally filtered by status (pending, published, failed, cancelled).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'published', 'failed', 'cancelled'],
          description: 'Filter by status. If not specified, returns all scheduled posts.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to retrieve (1-100)',
          default: 50,
          minimum: 1,
          maximum: 100
        }
      }
    }
  },
  {
    name: 'linkedin_cancel_scheduled_post',
    description: 'Cancel a scheduled post before it is published. Only pending posts can be cancelled.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'UUID of the scheduled post to cancel'
        }
      },
      required: ['postId']
    }
  },
  {
    name: 'linkedin_get_scheduled_post',
    description: 'Get details of a single scheduled post by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: {
          type: 'string',
          description: 'UUID of the scheduled post'
        }
      },
      required: ['postId']
    }
  },
  // Rich media tools
  {
    name: 'linkedin_create_poll',
    description: 'Create a LinkedIn poll post to engage your audience. Polls can have 2-4 options and run for 1 day, 3 days, 1 week, or 2 weeks.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The poll question (max 140 characters)'
        },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Option text (max 30 characters)'
              }
            },
            required: ['text']
          },
          minItems: 2,
          maxItems: 4,
          description: 'Poll options (2-4 choices, each max 30 characters)'
        },
        duration: {
          type: 'string',
          enum: ['ONE_DAY', 'THREE_DAYS', 'SEVEN_DAYS', 'FOURTEEN_DAYS'],
          default: 'THREE_DAYS',
          description: 'How long the poll runs: ONE_DAY (1 day), THREE_DAYS (3 days), SEVEN_DAYS (1 week), FOURTEEN_DAYS (2 weeks)'
        },
        commentary: {
          type: 'string',
          description: 'Optional post text to accompany the poll (max 3000 characters)'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the poll'
        }
      },
      required: ['question', 'options']
    }
  },
  {
    name: 'linkedin_create_post_with_document',
    description: 'Create a LinkedIn post with an uploaded document (PDF, PPT, DOC). Great for sharing presentations, reports, and documents. Max file size: 100 MB, max pages: 300.',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters)'
        },
        documentPath: {
          type: 'string',
          description: 'Local file path to the document (PDF, DOC, DOCX, PPT, PPTX)'
        },
        title: {
          type: 'string',
          description: 'Custom title for the document (max 400 characters). Defaults to filename if not provided.'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary', 'documentPath']
    }
  },
  {
    name: 'linkedin_create_post_with_video',
    description: 'Create a LinkedIn post with an uploaded video. Supports MP4, MOV, AVI, WMV, WebM, MKV formats. Max file size: 200 MB for personal accounts.',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters)'
        },
        videoPath: {
          type: 'string',
          description: 'Local file path to the video (MP4, MOV, AVI, WMV, WebM, MKV, M4V, FLV)'
        },
        title: {
          type: 'string',
          description: 'Custom title for the video (max 400 characters). Defaults to filename if not provided.'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary', 'videoPath']
    }
  },
  {
    name: 'linkedin_create_post_with_multi_images',
    description: 'Create a LinkedIn post with multiple images (2-20 images). Great for sharing photo albums, step-by-step tutorials, or before/after comparisons.',
    inputSchema: {
      type: 'object',
      properties: {
        commentary: {
          type: 'string',
          description: 'Post text content (max 3000 characters)'
        },
        imagePaths: {
          type: 'array',
          items: {
            type: 'string'
          },
          minItems: 2,
          maxItems: 20,
          description: 'Array of local file paths to images (2-20 images, PNG, JPG, or GIF)'
        },
        altTexts: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Optional array of accessibility text for each image (max 300 characters each)'
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS', 'LOGGED_IN', 'CONTAINER'],
          default: 'PUBLIC',
          description: 'Who can see the post'
        }
      },
      required: ['commentary', 'imagePaths']
    }
  }
];

/**
 * Handle list_tools request
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_DEFINITIONS
  };
});

/**
 * Handle call_tool request
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'linkedin_create_post':
        result = await tools.linkedin_create_post(args);
        break;

      case 'linkedin_create_post_with_link':
        result = await tools.linkedin_create_post_with_link(args);
        break;

      case 'linkedin_get_my_posts':
        result = await tools.linkedin_get_my_posts(args);
        break;

      case 'linkedin_delete_post':
        result = await tools.linkedin_delete_post(args);
        break;

      case 'linkedin_get_auth_url':
        result = await tools.linkedin_get_auth_url();
        break;

      case 'linkedin_exchange_code':
        result = await tools.linkedin_exchange_code(args);
        break;

      case 'linkedin_get_user_info':
        result = await tools.linkedin_get_user_info();
        break;

      case 'linkedin_update_post':
        result = await tools.linkedin_update_post(args);
        break;

      case 'linkedin_create_post_with_image':
        result = await tools.linkedin_create_post_with_image(args);
        break;

      case 'linkedin_refresh_token':
        result = await tools.linkedin_refresh_token(args);
        break;

      case 'linkedin_add_comment':
        result = await tools.linkedin_add_comment(args);
        break;

      case 'linkedin_add_reaction':
        result = await tools.linkedin_add_reaction(args);
        break;

      // Scheduling tools
      case 'linkedin_schedule_post':
        result = await tools.linkedin_schedule_post(args);
        break;

      case 'linkedin_list_scheduled_posts':
        result = await tools.linkedin_list_scheduled_posts(args);
        break;

      case 'linkedin_cancel_scheduled_post':
        result = await tools.linkedin_cancel_scheduled_post(args);
        break;

      case 'linkedin_get_scheduled_post':
        result = await tools.linkedin_get_scheduled_post(args);
        break;

      // Rich media tools
      case 'linkedin_create_poll':
        result = await tools.linkedin_create_poll(args);
        break;

      case 'linkedin_create_post_with_document':
        result = await tools.linkedin_create_post_with_document(args);
        break;

      case 'linkedin_create_post_with_video':
        result = await tools.linkedin_create_post_with_video(args);
        break;

      case 'linkedin_create_post_with_multi_images':
        result = await tools.linkedin_create_post_with_multi_images(args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      const validationErrors = error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Validation error:\n${validationErrors}`
          }
        ],
        isError: true
      };
    }

    // Handle API errors
    if (error.response) {
      return {
        content: [
          {
            type: 'text',
            text: `LinkedIn API error: ${error.message}\nStatus: ${error.response.statusCode}\nDetails: ${JSON.stringify(error.response.body, null, 2)}`
          }
        ],
        isError: true
      };
    }

    // Generic error
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP protocol)
  console.error('LinkedIn MCP server running on stdio');
  console.error(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.error(`Access token configured: ${!!process.env.LINKEDIN_ACCESS_TOKEN}`);
  console.error(`Person ID configured: ${!!process.env.LINKEDIN_PERSON_ID}`);
}

main().catch((error) => {
  console.error('Fatal error starting MCP server:', error);
  process.exit(1);
});
