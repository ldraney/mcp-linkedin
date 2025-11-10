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
