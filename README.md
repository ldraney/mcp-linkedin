# mcp-linkedin

MCP server for managing LinkedIn posts - create text, image, video, document, poll, and multi-image posts. Schedule posts, add comments and reactions.

## Installation

### MCPB Bundle (One-Click)
Download from [latest release](https://github.com/intelligent-staffing-systems/mcp-linkedin/releases/latest) and open `mcp-linkedin.mcpb` with Claude Desktop.

### npm / npx
```bash
npx @ldraney/mcp-linkedin
```

### Manual MCP Config
```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["@ldraney/mcp-linkedin"],
      "env": {
        "LINKEDIN_CLIENT_ID": "your-client-id",
        "LINKEDIN_CLIENT_SECRET": "your-client-secret",
        "LINKEDIN_REDIRECT_URI": "https://localhost:8888/callback",
        "LINKEDIN_PERSON_ID": "your-person-id",
        "LINKEDIN_ACCESS_TOKEN": "your-access-token"
      }
    }
  }
}
```

## Tools (20 Total)

### Content Creation
| Tool | Description |
|------|-------------|
| `linkedin_create_post` | Create text posts |
| `linkedin_create_post_with_link` | Posts with article/link preview |
| `linkedin_create_post_with_image` | Upload image + create post |
| `linkedin_create_post_with_video` | Upload video + create post |
| `linkedin_create_post_with_document` | Upload PDF/PPT/DOC + create post |
| `linkedin_create_post_with_multi_images` | Upload 2-20 images + create post |
| `linkedin_create_poll` | Create poll posts (2-4 options) |

### Content Management
| Tool | Description |
|------|-------------|
| `linkedin_get_my_posts` | Retrieve recent posts (paginated) |
| `linkedin_update_post` | Edit existing posts |
| `linkedin_delete_post` | Delete by URN |

### Social Interactions
| Tool | Description |
|------|-------------|
| `linkedin_add_comment` | Add comment to a post |
| `linkedin_add_reaction` | React to a post (LIKE, PRAISE, etc.) |

### Scheduling
| Tool | Description |
|------|-------------|
| `linkedin_schedule_post` | Schedule for future publication |
| `linkedin_list_scheduled_posts` | List by status |
| `linkedin_cancel_scheduled_post` | Cancel pending post |
| `linkedin_get_scheduled_post` | Get scheduled post details |

### Authentication
| Tool | Description |
|------|-------------|
| `linkedin_get_auth_url` | Start OAuth flow |
| `linkedin_exchange_code` | Complete OAuth |
| `linkedin_refresh_token` | Refresh expired token |
| `linkedin_get_user_info` | Get profile info |

## Setup

### Option 1: Quick Setup (Recommended)
1. Install the extension
2. Ask Claude: "Help me set up LinkedIn authentication"
3. Follow the guided OAuth flow

### Option 2: Manual Setup
1. Create a LinkedIn Developer App at https://www.linkedin.com/developers/apps
2. Add products: "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn"
3. Configure redirect URI: `https://localhost:8888/callback`
4. Set environment variables (see Installation above)

## Running the Scheduler

For scheduled posts to publish automatically:
```bash
npm run scheduler
```

This runs a daemon that checks every minute for posts due to publish.

## Development

```bash
npm install
npm test              # 118 tests
npm run test:coverage # Coverage report
npm start             # Start MCP server
npm run scheduler     # Start scheduler daemon
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project structure and API details
- [MCP_SETUP.md](./MCP_SETUP.md) - Claude Desktop configuration
- [LINKEDIN_API_REFERENCE.md](./LINKEDIN_API_REFERENCE.md) - API documentation

## License

MIT
