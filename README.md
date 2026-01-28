# mcp-linkedin

**Post to LinkedIn from Claude Desktop.**

Install in 30 seconds. Authenticate once. Post forever.

## Quick Start

### Option A: One-Click Install (Recommended)
1. **Download** [mcp-linkedin.mcpb](https://github.com/ldraney/mcp-linkedin/releases/latest/download/mcp-linkedin.mcpb)
2. **Open** with Claude Desktop
3. **Authorize** when prompted (one-time LinkedIn OAuth)

### Option B: Command Line
```bash
npx @ldraney/mcp-linkedin
```

## What You Can Do

Ask Claude things like:
- *"Post about my new GitHub project with a link"*
- *"Create a poll asking my network about AI trends"*
- *"Schedule a post for tomorrow at 9am"*
- *"Upload this PDF and share it with my network"*
- *"Add a comment to my latest post"*

## 21 Tools Available

| Category | Tools |
|----------|-------|
| **Posting** | Text, links, images, videos, documents, polls |
| **Multi-media** | Up to 20 images per post |
| **Scheduling** | Schedule posts for future publication |
| **Engagement** | Comment and react to posts |
| **Management** | Edit, delete, list your posts |

## How It Works

```
You install mcp-linkedin (npm or .mcpb)
         │
         └─► First use triggers OAuth
                   │
                   └─► Tokens stored locally on your machine
                             │
                             └─► Claude posts to LinkedIn for you
```

Your credentials stay on your machine. The OAuth relay only handles the initial handshake.

## Privacy

- Your LinkedIn access token is stored locally on your machine
- We never store or access your LinkedIn credentials
- All API calls go directly from your machine to LinkedIn

## Requirements

- [Claude Desktop](https://claude.ai/download)
- LinkedIn account

## Feedback

Found a bug? Have a feature request?
[Open an issue](https://github.com/ldraney/mcp-linkedin/issues/new)

For security vulnerabilities, see [SECURITY.md](./SECURITY.md).

## For Developers

```bash
git clone https://github.com/ldraney/mcp-linkedin.git
cd mcp-linkedin
npm install
npm test  # 118 tests
```

See [CLAUDE.md](./CLAUDE.md) for architecture and API details.

## License

MIT
