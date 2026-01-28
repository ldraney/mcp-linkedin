# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in mcp-linkedin, please report it responsibly:

1. **Do NOT open a public issue** for security vulnerabilities
2. **Email:** Open a [private security advisory](https://github.com/ldraney/mcp-linkedin/security/advisories/new) on GitHub
3. **Include:** Description of the vulnerability, steps to reproduce, and potential impact

You should receive a response within 48 hours. We'll work with you to understand the issue and coordinate a fix before any public disclosure.

## Security Model

### Credential Storage

- OAuth tokens are stored in your **operating system's secure keychain** (macOS Keychain, Windows Credential Manager, Linux Secret Service) via [@napi-rs/keyring](https://github.com/nicedoc/keyring)
- Environment variables (`.env`) are supported as a fallback for development setups
- Legacy plaintext credential file support (`~/.mcp-linkedin-credentials.json`) was removed in v0.3.x
- Token values are masked in all tool outputs to prevent accidental exposure in logs or chat history
- The OAuth relay server (`fly.io`) only handles the initial handshake redirect -- it never sees or stores your access token

### Data Flow

```
Your Machine                    External
┌─────────────────┐            ┌──────────────┐
│ Claude Desktop  │            │              │
│   ├─ mcp-linkedin│──────────►│ LinkedIn API │
│   └─ OS Keychain│            │              │
└─────────────────┘            └──────────────┘
        │
        │ (OAuth only)
        ▼
┌─────────────────┐
│ OAuth Relay     │
│ (fly.io)        │
│ Redirect only   │
└─────────────────┘
```

- All LinkedIn API calls go **directly** from your machine to LinkedIn
- No telemetry, analytics, or data collection
- Scheduled posts are stored in a **local** SQLite database on your machine

### OAuth Security

- CSRF protection via cryptographic nonces on every OAuth flow
- Tokens are captured by a local callback server and stored directly in your keychain
- The `w_member_social` scope is the only permission requested (post and interact on your behalf)

### What We Don't Do

- We never store your credentials on any remote server
- We never log or transmit your LinkedIn data
- We never access your LinkedIn connections, messages, or profile data beyond what you explicitly post

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Dependencies

We keep dependencies minimal to reduce attack surface. Run `npm audit` to check for known vulnerabilities in dependencies.
