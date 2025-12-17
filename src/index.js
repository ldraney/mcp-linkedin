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
