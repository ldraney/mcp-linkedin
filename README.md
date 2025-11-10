# mcp-linkedin

MCP server for managing LinkedIn posts - create, update, and manage posts to share expertise and GitHub projects.

## Overview

This MCP (Model Context Protocol) server enables programmatic management of LinkedIn posts. The primary use case is to help share technical expertise, showcase GitHub projects, and engage with a professional audience through LinkedIn's platform.

## User Story

As a technical professional, I want to:
- Create LinkedIn posts that link to my GitHub projects
- Update existing posts to reflect project changes
- Manage my LinkedIn content programmatically
- Share my expertise and educational content with my professional network

This tool is designed to help educate and demonstrate expertise to a LinkedIn audience through consistent, high-quality content sharing.

## Status

✅ **MVP Complete** - All core tools implemented and tested!

**Milestones:**
- ✅ LinkedIn Developer App with OAuth 2.0
- ✅ 7 MCP tools implemented (create, get, delete posts + auth)
- ✅ 24 automated tests passing
- ✅ Type-safe with JSDoc + Zod validation
- ✅ MCP server with stdio transport
- ✅ Ready for Claude Desktop integration

## Features

### ✅ Implemented (MVP)

- **linkedin_create_post** - Create simple text posts with hashtags and mentions
- **linkedin_create_post_with_link** - Create posts with link previews (GitHub, blogs, etc.)
- **linkedin_get_my_posts** - Retrieve your recent posts with pagination
- **linkedin_delete_post** - Delete posts by URN
- **linkedin_get_auth_url** - Generate OAuth authorization URL
- **linkedin_exchange_code** - Exchange auth code for access token
- **linkedin_get_user_info** - Get your LinkedIn profile information

### 🚧 Planned (Next Phase)

- **Post scheduling** - Schedule posts for future publication (HIGH PRIORITY)
- **Draft management** - Save and manage draft posts locally
- **Image uploads** - Create posts with images
- **Post updates** - Edit existing posts
- **Analytics** - View post engagement metrics (if API supports)

## LinkedIn API

This MCP will utilize LinkedIn's REST API:
- Base URL: `https://api.linkedin.com/rest/posts`
- Authentication: OAuth 2.0
- Required permissions: `w_member_social` scope
- API Documentation: [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)

## Development Philosophy

1. Start with clear user stories based on LinkedIn API capabilities
2. Refine requirements through discussion and iteration
3. Build incrementally with well-defined issues and branches
4. Test thoroughly with real-world use cases

## Getting Started

### Prerequisites

1. Create a LinkedIn Developer App at https://www.linkedin.com/developers/apps
2. Add these products to your app:
   - "Sign In with LinkedIn using OpenID Connect"
   - "Share on LinkedIn"
3. Configure OAuth redirect URI (e.g., `https://localhost:3000/callback`)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/intelligent-staffing-systems/mcp-linkedin.git
cd mcp-linkedin
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example` and fill in your values):
```bash
cp .env.example .env
```

4. Run tests:
```bash
npm test  # All 24 tests should pass
```

5. **Setup with Claude Desktop:**

See [MCP_SETUP.md](./MCP_SETUP.md) for detailed Claude Desktop configuration instructions.

### Environment Variables

See `.env.example` for required configuration:
- `LINKEDIN_CLIENT_ID` - Your app's client ID
- `LINKEDIN_CLIENT_SECRET` - Your app's client secret
- `LINKEDIN_REDIRECT_URI` - OAuth callback URL
- `LINKEDIN_PERSON_ID` - Your LinkedIn person URN (from userinfo endpoint)
- `LINKEDIN_ACCESS_TOKEN` - OAuth access token (60-day expiry)

## Documentation

- **[MCP_SETUP.md](./MCP_SETUP.md)** - Claude Desktop configuration and usage guide
- **[USER_STORY.md](./USER_STORY.md)** - Complete user stories and feature roadmap
- **[LINKEDIN_API_REFERENCE.md](./LINKEDIN_API_REFERENCE.md)** - Comprehensive API documentation
- **[src/types.js](./src/types.js)** - JSDoc type definitions
- **[src/schemas.js](./src/schemas.js)** - Zod validation schemas

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

All 24 tests passing with 100% code coverage for core tools!

## Contributing

Lucas Draney (@ldraney)

## License

MIT
