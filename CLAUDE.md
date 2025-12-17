# MCP-LinkedIn

MCP server for LinkedIn post management via Claude Desktop.

## Project Structure

```
src/
  index.js       # MCP server entry point (stdio transport)
  tools.js       # 12 tool implementations
  linkedin-api.js # LinkedIn REST API client
  schemas.js     # Zod validation schemas
  types.js       # JSDoc type definitions
__tests__/       # Jest test suite (50 tests)
```

## Current Tools (Phase 2.5 Complete)

| Tool | Description |
|------|-------------|
| `linkedin_create_post` | Create text posts |
| `linkedin_create_post_with_link` | Posts with article/link preview |
| `linkedin_create_post_with_image` | Upload image + create post |
| `linkedin_get_my_posts` | Retrieve recent posts (paginated) |
| `linkedin_update_post` | Edit existing posts (commentary, CTA, landing page) |
| `linkedin_delete_post` | Delete by URN |
| `linkedin_add_comment` | Add comment to a post |
| `linkedin_add_reaction` | React to a post (LIKE, PRAISE, EMPATHY, etc.) |
| `linkedin_get_auth_url` | Start OAuth flow |
| `linkedin_exchange_code` | Complete OAuth |
| `linkedin_refresh_token` | Refresh expired access token |
| `linkedin_get_user_info` | Get profile info |

## LinkedIn API

- **Base URL**: `https://api.linkedin.com/rest/`
- **Version**: 202510 (YYYYMM format in `LinkedIn-Version` header)
- **Auth**: OAuth 2.0 with `w_member_social` scope
- **Token Expiry**: 60 days

Key endpoints:
- `POST /rest/posts` - Create post
- `GET /rest/posts?author={urn}&q=author` - Get posts
- `DELETE /rest/posts/{urn}` - Delete post
- `POST /rest/posts/{urn}` + `X-RestLi-Method: PARTIAL_UPDATE` - Update post
- `POST /rest/socialActions/{postUrn}/comments` - Add comment
- `POST /rest/reactions?actor={personUrn}` - Add reaction

## Environment Variables

Required in `.env`:
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI` (currently `https://localhost:8888/callback`)
- `LINKEDIN_PERSON_ID`
- `LINKEDIN_ACCESS_TOKEN` (current token expires ~Feb 15, 2026)
- `LINKEDIN_API_VERSION` (default: 202510)

**Note:** Multiple redirect URIs configured in LinkedIn Developer Portal: `localhost:3000`, `localhost:8888`, and Supabase callback.

## Running

```bash
npm start        # Start MCP server
npm test         # Run tests (50 passing)
```

## Roadmap

### Phase 2: Content Management (COMPLETE)

- [x] **`linkedin_update_post`** - Edit existing posts
  - Endpoint: `POST /rest/posts/{urn}` with `X-RestLi-Method: PARTIAL_UPDATE`
  - Body: `{ "patch": { "$set": { "commentary": "new text" } } }`
  - Updatable: commentary, contentCallToActionLabel, contentLandingPage

- [x] **`linkedin_create_post_with_image`** - Upload + post images
  - Requires: Images API upload first to get `urn:li:image:{id}`
  - Then: Create post with `content.media.id`
  - Supported: PNG, JPG, GIF

- [x] **`linkedin_refresh_token`** - Refresh expired access tokens
  - Uses refresh token from initial OAuth flow
  - Returns new access token with expiry info

### Phase 2.5: Social Interactions (COMPLETE)

- [x] **`linkedin_add_comment`** - Comment on posts
  - Endpoint: `POST /rest/socialActions/{postUrn}/comments`
  - Max 1250 characters

- [x] **`linkedin_add_reaction`** - React to posts
  - Endpoint: `POST /rest/reactions?actor={personUrn}`
  - Types: LIKE, PRAISE, EMPATHY, INTEREST, APPRECIATION, ENTERTAINMENT

### Phase 3: Scheduling (Custom Implementation)

LinkedIn API does NOT support native scheduling. Must build custom:

- [ ] **`linkedin_schedule_post`** - Schedule for future time
  - Store in SQLite (todos.db already exists)
  - Fields: id, commentary, url, visibility, scheduled_time, status

- [ ] **`linkedin_list_scheduled_posts`** - View pending posts

- [ ] **`linkedin_cancel_scheduled_post`** - Cancel before publish

- [ ] **Scheduler daemon** - Cron/node-cron to check and publish
  - Check every minute for posts due
  - Retry logic for failures
  - Log all events

### Phase 4: Rich Media (All possible with current `w_member_social` scope)

- [ ] **Video posts** - Via Videos API + Posts API
- [ ] **Document posts** - PDFs, PPTs, DOCs via Documents API + Posts API
- [ ] **Multi-image posts** - Via MultiImage API
- [ ] **Poll posts** - Via Poll API

### Phase 5: Integrations (Custom)

- [ ] **Draft management** - Local draft storage (API doesn't support)
- [ ] **GitHub integration** - Auto-post from releases/PRs

## What's Possible with Current Permissions

All features in Phases 2-4 work with existing `w_member_social` scope. No additional API access needed.

| Content Type | Supported | Notes |
|--------------|-----------|-------|
| Text | Yes | Posts API |
| Link/Article | Yes | Posts API |
| Image | Yes | Images API + Posts API |
| Video | Yes | Videos API + Posts API |
| Document | Yes | Documents API + Posts API |
| Multi-Image | Yes | MultiImage API |
| Poll | Yes | Poll API |
| Carousel | **No** | Sponsored accounts only |

## API Limitations (Not Permission Issues)

| Feature | Status |
|---------|--------|
| Native scheduling | Not supported (build custom) |
| Draft storage | Not supported (build custom) |
| Rate limits | Undocumented (use exponential backoff) |
| Analytics for personal posts | Unknown/undocumented |
| Profile editing | Not available via API |
| Connections list | Requires Partner Program |
| Messaging | Not available via API |

## Additional API Capabilities (Documented, Not Yet Implemented)

### Comments API (`/rest/socialActions/{postUrn}/comments`)
- Create, read, edit, delete comments
- Nested/threaded comments supported
- Requires `w_member_social` scope

### Reactions API (`/rest/reactions`)
- Add/remove reactions on posts and comments
- Types: `LIKE`, `PRAISE` (Celebrate), `EMPATHY` (Love), `INTEREST` (Insightful), `APPRECIATION` (Support), `ENTERTAINMENT` (Funny)
- Requires `w_member_social` scope

### Images API (`/rest/images`)
1. `POST /rest/images?action=initializeUpload` - Get upload URL
2. PUT binary to upload URL
3. Use `urn:li:image:{id}` in post's `content.media.id`
- Supports: PNG, JPG, GIF (up to 250 frames)
- Max: 36,152,320 pixels

## Testing

```bash
npm test              # All tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:manual   # Manual API test (test_post.js)
```

## References

- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn Authentication](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [USER_STORY.md](./USER_STORY.md) - Full user stories
- [LINKEDIN_API_REFERENCE.md](./LINKEDIN_API_REFERENCE.md) - API details
