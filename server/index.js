#!/usr/bin/env node
// This file exists as a required entry_point for the mcpb manifest.
// The actual server is run via npx @ldraney/mcp-linkedin in mcp_config.
// This shim is not used at runtime.
console.error('This shim should not be called directly. The server runs via npx.');
process.exit(1);
