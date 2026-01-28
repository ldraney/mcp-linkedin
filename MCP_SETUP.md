# MCP Server Setup for Claude Desktop

## Prerequisites

1. ✅ LinkedIn Developer App created
2. ✅ OAuth credentials obtained
3. ✅ Access token and person ID in `.env` file

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Ensure your `.env` file has all required variables:

```bash
# LinkedIn OAuth Credentials
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=https://localhost:3000/callback

# LinkedIn API
LINKEDIN_API_VERSION=202510
LINKEDIN_PERSON_ID=your_person_id

# Access Token (expires in 60 days)
LINKEDIN_ACCESS_TOKEN=your_access_token
```

### 3. Test the MCP Server Locally

Test that the server starts correctly:

```bash
npm start
```

You should see:
```
LinkedIn MCP server running on stdio
Environment: development
Access token configured: true
Person ID configured: true
```

Press `Ctrl+C` to stop.

## Claude Desktop Configuration

### 1. Locate Claude Desktop Config

**macOS/Linux:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

### 2. Add MCP Server Configuration

Edit `claude_desktop_config.json` and add the `mcp-linkedin` server:

```json
{
  "mcpServers": {
    "mcp-linkedin": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-linkedin/src/index.js"],
      "env": {
        "LINKEDIN_CLIENT_ID": "your_client_id",
        "LINKEDIN_CLIENT_SECRET": "your_client_secret",
        "LINKEDIN_REDIRECT_URI": "https://localhost:3000/callback",
        "LINKEDIN_API_VERSION": "202510",
        "LINKEDIN_PERSON_ID": "your_person_id",
        "LINKEDIN_ACCESS_TOKEN": "your_access_token",
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Important:** Replace `/absolute/path/to/mcp-linkedin` with the actual absolute path!

To get the absolute path:
```bash
cd /path/to/mcp-linkedin
pwd
```

### 3. Restart Claude Desktop

Completely quit and restart Claude Desktop for changes to take effect.

## Verify Installation

In Claude Desktop, you should now see the LinkedIn MCP tools available:

1. **linkedin_create_post** - Create simple text posts
2. **linkedin_create_post_with_link** - Create posts with link previews
3. **linkedin_get_my_posts** - Retrieve your recent posts
4. **linkedin_delete_post** - Delete a post by URN
5. **linkedin_get_auth_url** - Generate OAuth URL
6. **linkedin_exchange_code** - Exchange auth code for token
7. **linkedin_get_user_info** - Get your profile info

## Usage Examples

### Create a Simple Post

```
Create a LinkedIn post:

"Just shipped a new feature! 🚀 Our team built an automated deployment pipeline that reduced deploy time by 60%. Excited to share what we learned. #devops #automation"
```

Claude will call:
```javascript
linkedin_create_post({
  commentary: "Just shipped a new feature! 🚀 ...",
  visibility: "PUBLIC"
})
```

### Create a Post with GitHub Link

```
Create a LinkedIn post about my new project at https://github.com/ldraney/mcp-linkedin with the title "MCP-LinkedIn: Automate Your Posts"
```

Claude will call:
```javascript
linkedin_create_post_with_link({
  commentary: "Excited to share my latest open-source project!",
  url: "https://github.com/ldraney/mcp-linkedin",
  title: "MCP-LinkedIn: Automate Your Posts",
  visibility: "PUBLIC"
})
```

### Retrieve Your Posts

```
Show me my last 5 LinkedIn posts
```

Claude will call:
```javascript
linkedin_get_my_posts({
  limit: 5,
  offset: 0
})
```

### Delete a Post

```
Delete LinkedIn post urn:li:share:7393762149422116864
```

Claude will call:
```javascript
linkedin_delete_post({
  postUrn: "urn:li:share:7393762149422116864"
})
```

## Troubleshooting

### "Access token configured: false"

Your `.env` file is missing or `LINKEDIN_ACCESS_TOKEN` is not set. Make sure:
1. `.env` file exists in the project root
2. `LINKEDIN_ACCESS_TOKEN` is set with a valid token

### "LinkedIn API error: 401"

Your access token has expired (60-day lifetime). Get a new token:

```
Get me a new LinkedIn OAuth URL
```

Then follow the authorization flow and exchange the code for a new token.

### MCP Server Not Showing in Claude Desktop

1. Check that the path in `claude_desktop_config.json` is **absolute** (not relative)
2. Verify all environment variables are set correctly
3. Restart Claude Desktop completely (quit, don't just close window)
4. Check Claude Desktop logs for errors

### Posts Not Appearing on LinkedIn

1. Verify you're logged into the correct LinkedIn account
2. Check post visibility (PUBLIC vs CONNECTIONS)
3. LinkedIn may have rate limits - wait a few minutes between posts
4. Verify your access token has `w_member_social` scope

## Token Refresh

Access tokens expire after 60 days. To refresh:

1. Get a new authorization URL:
   ```
   Get me a LinkedIn auth URL
   ```

2. Visit the URL in your browser and authorize

3. Copy the authorization code from the callback URL

4. Exchange the code:
   ```
   Exchange this LinkedIn auth code: AQR9vB6le8n...
   ```

5. Update your `.env` and Claude Desktop config with the new token

## Security Notes

- **Never commit `.env` to git** (already in `.gitignore`)
- Access tokens are sensitive - treat them like passwords
- Tokens expire after 60 days - set a reminder to refresh
- Only share posts with appropriate visibility settings

## Support

For issues or questions:
- Check the [main README](./README.md)
- Review [User Story](https://ldraney.github.io/mcp-linkedin/user-story.html) for feature details
- Open an issue on GitHub

---

**Configured and ready to post!** 🎉
