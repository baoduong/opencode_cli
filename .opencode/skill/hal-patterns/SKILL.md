---
name: hal-patterns
description: HAL coding standards, conventions, and development patterns across all HAL repositories
---

# HAL Coding Standards & Patterns

## General Conventions
- Match existing code style of the file/repo being modified
- Never suppress type errors (`as any`, `@ts-ignore`, `@ts-expect-error`)
- Never leave empty catch blocks
- Fix root cause, not symptoms
- Minimal changes — don't refactor while fixing bugs
- Commit-ready code: no TODOs, no commented-out code

## TypeScript Standards
- **Strict mode**: Always enabled (`"strict": true`)
- **Module system**: ESM (import/export)
- **Target**: ESNext
- **Module resolution**: bundler
- **Linter**: Biome (not ESLint) in newer projects
- **Type exports**: Always include type definitions

## Angular (most HAL frontends)
- Use Signals for new state management (migration in progress)
- Follow component structure in service architecture doc
- Use existing data fetching patterns (HttpClient, services)
- Follow naming conventions from patterns.md

## Backend / API
- Follow existing endpoint patterns (REST conventions, error formats)
- Match error handling approach used in the service
- Use established authentication/authorization patterns
- Follow database access patterns (ORM, query builders — match what exists)

## Shared Libraries (@hal/*)
- Changes affect multiple consumers — check relationships.md
- Be extra conservative — test impact across consumers
- Maintain backward compatibility unless explicitly breaking

## Test Patterns
- Test actual implementation, don't duplicate logic
- Match existing test style in the repo
- Follow testing patterns from knowledge base
- Coverage thresholds enforced per service

## Knowledge-First Development
1. Read knowledge base BEFORE writing code
2. Check patterns.md for conventions
3. Check architecture doc for service structure
4. Check relationships.md for impact analysis
5. If knowledge missing, report gap to appropriate HAL agent
