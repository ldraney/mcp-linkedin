# LinkedIn API Reference Documentation

## Summary

This document consolidates LinkedIn API documentation for the MCP server implementation. LinkedIn does **not provide an official OpenAPI/Swagger specification**, so this reference is compiled from official Microsoft Learn documentation.

**Key Finding**: The community swagger.json (Mermade repo) is outdated (v1 API, archived 2021) and should not be used.

## Current API Version

- **Base URL**: `https://api.linkedin.com/rest/` (preferred for Posts API)
- **Legacy Base**: `https://api.linkedin.com/v2/` (being phased out)
- **Latest Version**: Marketing 2025-10 (YYYYMM format)
- **TLS Requirement**: TLS 1.1+ (TLS 1.0 not supported)

---

## Authentication

### OAuth 2.0 Flow Types

#### 1. Member Authorization (3-legged OAuth) - **Required for posting**

Used for accessing member-specific resources and posting on their behalf.

**Flow**:
1. Redirect user to authorization URL
2. User grants permissions
3. Exchange authorization code for access token
4. Use access token in API requests

**Required for**: Personal posts, member social actions

#### 2. Application Authorization (2-legged OAuth)

Used for non-member-specific API access (limited support).

**Not supported by**: Marketing APIs (which include Posts API)

### Permission Scopes

| Scope | Access Level | Use Case |
|-------|--------------|----------|
| `w_member_social` | Write member social content | **Required for personal posts** |
| `r_member_social` | Read member social content | Retrieve member posts (approved users only) |
| `w_organization_social` | Write organization content | Post on behalf of company pages |
| `r_organization_social` | Read organization content | Retrieve organization posts |

**Important**:
- `w_member_social` requires joining LinkedIn's **Marketing Developer Program**
- Organization access requires ADMINISTRATOR, DIRECT_SPONSORED_CONTENT_POSTER, or CONTENT_ADMIN role

### Required Headers (All Requests)

```http
Authorization: Bearer {access_token}
LinkedIn-Version: {YYYYMM}
X-Restli-Protocol-Version: 2.0.0
Content-Type: application/json
```

For special operations:
- **Batch GET**: Add `X-RestLi-Method: BATCH_GET`
- **Partial Update**: Add `X-RestLi-Method: PARTIAL_UPDATE`

---

## Posts API Endpoints

### 1. Create Post

**Endpoint**: `POST /rest/posts`

**Request Body** (Minimum required):
```json
{
  "author": "urn:li:person:{id}",
  "commentary": "Your post text here",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED"
  },
  "lifecycleState": "PUBLISHED"
}
```

**Response**: `201 Created`
- Post URN in header: `x-restli-id: urn:li:share:{id}`

**Visibility Options**:
- `PUBLIC`: Visible to all LinkedIn members
- `CONNECTIONS`: Only 1st-degree connections
- `LOGGED_IN`: All logged-in LinkedIn members
- `CONTAINER`: Organization followers only

**Feed Distribution**:
- `MAIN_FEED`: Appears in follower feeds
- `NONE`: Does not appear in feeds (dark post)

---

### 2. Create Post with Link

```json
{
  "author": "urn:li:person:{id}",
  "commentary": "Check out my latest project! #coding #github",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED"
  },
  "content": {
    "article": {
      "source": "https://github.com/username/project",
      "title": "My Awesome Project",
      "description": "A tool that solves X problem"
    }
  },
  "lifecycleState": "PUBLISHED"
}
```

---

### 3. Create Post with Image

**Prerequisites**: Upload image using Images API to get URN

```json
{
  "author": "urn:li:person:{id}",
  "commentary": "Visual showcase of my work",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED"
  },
  "content": {
    "media": {
      "id": "urn:li:image:{image_id}"
    }
  },
  "lifecycleState": "PUBLISHED"
}
```

**Supported Media Types**:
- Images: `urn:li:image:{id}` (via Images API)
- Videos: `urn:li:video:{id}` (via Videos API)
- Documents: `urn:li:document:{id}` (PPT, DOC, PDF via Documents API)

---

### 4. Retrieve Single Post

**Endpoint**: `GET /rest/posts/{encoded_post_urn}`

**URN Encoding**: Encode colons as `%3A`
- Example: `urn:li:share:123` → `urn%3Ali%3Ashare%3A123`

**Response**: `200 OK` with full post object

---

### 5. Retrieve Posts by Author

**Endpoint**: `GET /rest/posts?author={author_urn}&q=author`

**Parameters**:
- `author`: `urn:li:person:{id}` or `urn:li:organization:{id}`
- `q`: Must be `author`

**Pagination** (assumed standard, not documented):
- `start`: Offset
- `count`: Results per page

---

### 6. Update Post

**Endpoint**: `POST /rest/posts/{encoded_post_urn}`

**Required Header**: `X-RestLi-Method: PARTIAL_UPDATE`

**Updatable Fields**:
- `commentary`
- `contentCallToActionLabel` (LEARN_MORE, APPLY, DOWNLOAD, etc.)
- `contentLandingPage` (URL)
- `lifecycleState` (PUBLISHED, DRAFT, etc.)

**Request Body**:
```json
{
  "patch": {
    "$set": {
      "commentary": "Updated post text"
    }
  }
}
```

**Response**: `204 No Content`

---

### 7. Delete Post

**Endpoint**: `DELETE /rest/posts/{encoded_post_urn}`

**Response**: `204 No Content`

**Note**: Idempotent - deleting an already deleted post returns 204

---

## Content Types Supported

| Content Type | Organic Posts | Sponsored Posts | API Required |
|--------------|---------------|-----------------|--------------|
| Text only | ✅ | ✅ | Posts API |
| Single Image | ✅ | ✅ | Images API + Posts API |
| Video | ✅ | ✅ | Videos API + Posts API |
| Document | ✅ | ✅ | Documents API + Posts API |
| Article/Link | ✅ | ✅ | Posts API |
| Carousel | ❌ | ✅ | Carousel API |
| Multi-Image | ✅ | ❌ | MultiImage API |
| Poll | ✅ | ❌ | Poll API |

---

## URN Formats

| Entity | URN Format |
|--------|-----------|
| Person | `urn:li:person:{id}` |
| Organization | `urn:li:organization:{id}` |
| Post (UGC) | `urn:li:ugcPost:{id}` |
| Post (Share) | `urn:li:share:{id}` |
| Image | `urn:li:image:{id}` |
| Video | `urn:li:video:{id}` |
| Document | `urn:li:document:{id}` |
| Sponsored Account | `urn:li:sponsoredAccount:{id}` |

---

## Response Status Codes

| Code | Meaning | Context |
|------|---------|---------|
| 200 | OK | Successful GET request |
| 201 | Created | Post created successfully |
| 204 | No Content | Successful update or delete |
| 400 | Bad Request | Invalid parameters or request body |
| 401 | Unauthorized | Missing or invalid access token |
| 403 | Forbidden | Insufficient permissions for operation |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |

---

## Rate Limits

**Not explicitly documented** in the Posts API reference. Likely:
- Application-level throttling
- Per-user throttling
- Recommend implementing exponential backoff for 429 responses

---

## Targeting & Audience (Organic Posts)

When using `targetEntities` in distribution:

**Available Facets**:
- `geoLocations`: Geographic targeting
- `industries`: Industry sectors
- `seniorities`: Job seniority levels
- `jobFunctions`: Job roles
- `interfaceLocales`: Language preferences
- `degrees`: Education levels
- `fieldsOfStudy`: Academic disciplines
- `organizations`: Companies/schools
- `staffCountRanges`: Company sizes

**Minimum Audience**: Target audience must exceed **300 members**

---

## Text Formatting (Commentary Field)

LinkedIn uses "Little Text Format" - specific formatting rules not documented in detail.

**Known**:
- Plain text supported
- Hashtags: `#hashtag`
- Mentions: `@{person/company}`
- URLs: Auto-linked
- Max length: Not specified (likely ~3000 characters)

---

## API Migration Notes

**Deprecation Warning**: Marketing API version 202410 has been sunset.

**Migration Path**:
- Old: `/v2/ugcPosts` → **New**: `/rest/posts`
- Old: `/v2/shares` → **New**: `/rest/posts`

**Action Required**: Update to versioned APIs with `LinkedIn-Version` header

---

## Missing from Documentation

These items are **not documented** and require testing or support contact:

1. ❌ Explicit rate limits
2. ❌ OAuth token refresh flow details
3. ❌ Post scheduling API
4. ❌ Draft posts API
5. ❌ Analytics/metrics API endpoints
6. ❌ Max commentary length
7. ❌ Batch create posts
8. ❌ Comment/reaction APIs for posts
9. ❌ Webhook/notification APIs

---

## Recommended MCP Tools

Based on this API analysis, the MCP should provide:

### Core Tools
1. `create_post(text, visibility)` - Simple text post
2. `create_post_with_link(text, url, title, description)` - Post with article preview
3. `create_post_with_image(text, image_path)` - Upload image + create post
4. `update_post(post_id, new_text)` - Edit existing post
5. `delete_post(post_id)` - Remove post
6. `get_my_posts(limit)` - Retrieve user's posts

### Authentication Tools
7. `start_oauth_flow()` - Initiate authorization
8. `exchange_code_for_token(code)` - Complete OAuth
9. `refresh_access_token()` - Renew token (if supported)

### Utility Tools
10. `get_author_urn()` - Get current user's URN
11. `validate_post_text(text)` - Check length/format
12. `preview_link(url)` - Test link metadata

---

## Implementation Priority

**MVP (Phase 1)**:
- OAuth 2.0 flow
- Create text posts
- Create posts with links
- Get user's posts
- Delete posts

**Phase 2**:
- Update posts
- Image uploads + posts
- Post analytics (if API available)

**Phase 3**:
- Video posts
- Document posts
- Advanced targeting
- Post scheduling (if API available)

---

## References

- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-10)
- [LinkedIn Authentication](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [LinkedIn API Methods](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/methods)
- [Community Swagger (Outdated)](https://github.com/Mermade/openapi-definitions/blob/master/LinkedIn/swagger.json)

---

**Last Updated**: 2025-11-10
**API Version**: Marketing 2025-10
