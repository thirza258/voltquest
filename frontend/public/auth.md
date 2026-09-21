# VoltQuest auth.md

## Overview

VoltQuest provides authentication and registration protocols for AI agents to interact with circuit simulation, PCB design, and embedded systems workspaces.

- **Audience**: AI Agents, Code Assistants, and Automated Systems
- **Resource Identifier**: `https://pcb.nevatal.id`
- **Authorization Server**: `https://pcb.nevatal.id`
- **Registration Endpoint**: `https://pcb.nevatal.id/api/agent/register`
- **Token Endpoint**: `https://pcb.nevatal.id/api/auth/token`
- **Supported Methods**: Bearer Token (`Authorization: Bearer <token>`)
- **Supported Scopes**: `read`, `write`, `simulation`, `mcp`

## Agent Registration Flow

Agents can register or provision an API token:

```http
POST /api/agent/register HTTP/1.1
Host: pcb.nevatal.id
Content-Type: application/json

{
  "client_name": "MyCodingAgent",
  "client_uri": "https://example.com/agent"
}
```

Response:
```json
{
  "access_token": "vq_agent_token_sample",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "scope": "read write simulation mcp"
}
```

## Discovery Endpoints

- OAuth Authorization Server Metadata: [/.well-known/oauth-authorization-server](https://pcb.nevatal.id/.well-known/oauth-authorization-server)
- OpenID Connect Configuration: [/.well-known/openid-configuration](https://pcb.nevatal.id/.well-known/openid-configuration)
- OAuth Protected Resource Metadata: [/.well-known/oauth-protected-resource](https://pcb.nevatal.id/.well-known/oauth-protected-resource)
- API Catalog: [/.well-known/api-catalog](https://pcb.nevatal.id/.well-known/api-catalog)
- MCP Server Card: [/.well-known/mcp/server-card.json](https://pcb.nevatal.id/.well-known/mcp/server-card.json)
- A2A Agent Card: [/.well-known/agent-card.json](https://pcb.nevatal.id/.well-known/agent-card.json)
- Agent Skills Discovery: [/.well-known/agent-skills/index.json](https://pcb.nevatal.id/.well-known/agent-skills/index.json)

