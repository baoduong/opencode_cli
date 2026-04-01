---
name: hal-security
description: HAL data privacy policy, approved LLM providers, prompt sanitization rules, and security constraints
---

# HAL Security & Data Privacy

## Allowed LLM Providers (CRITICAL)
1. **GitHub Copilot** (enterprise data privacy) — safe for general reasoning
2. **CodeVista** (self-hosted at 192.168.1.141:3100) — safe for ALL data including proprietary code

## Routing Rules
- **Code analysis, repo scanning, architecture review** → CodeVista preferred
- **General reasoning, planning, non-proprietary tasks** → GitHub Copilot OK
- **MCP tool results containing code** → CodeVista preferred

## Blocked Providers
- OpenRouter free tier — NO (data may be used for training)
- Any free-tier endpoint — NO
- Any provider without enterprise data privacy — NO

## Prompt Sanitization (before non-CodeVista calls)
- Strip company names, internal repo names, service names
- Remove API endpoints, internal URLs, IP addresses
- Remove credentials, tokens, keys
- Replace proprietary terms with generic equivalents

## Security Standards
- Zero-trust security model
- Okta SSO + Microsoft MFA for authentication
- Azure Key Vault for secrets management
- Never commit secrets to source code
- All API calls use HTTPS with mutual TLS where applicable
- Audit logging for all sensitive operations
