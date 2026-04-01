---
name: hal-architecture
description: HAL microservices architecture patterns, service boundaries, knowledge protocol, and multi-agent team coordination
---

# HAL Architecture & Knowledge System

## HAL Team — Multi-Agent System

5 specialized AI agents sharing a persistent knowledge base:

| Agent | Domain | Cost | Model |
|---|---|---|---|
| hal-technical-lead | Architecture, code flow tracing, bug investigation | EXPENSIVE | claude-opus-4.6 |
| hal-developer | Feature implementation, bug fixes, code changes | EXPENSIVE | gpt-5.3-codex |
| hal-qa-engineer | Testing, quality gates, coverage | CHEAP | claude-sonnet-4 |
| hal-explorer | Fleet-wide scanning, repo inventory, tech evaluation | FREE | gpt-5.3-codex |
| hal-doc-specialist | Documentation, guides, summaries | CHEAP | gpt-5.1-codex-mini |

## Knowledge Base Structure
```
~/.local/share/opencode/hal-knowledge/
├── index.md               # Master index (shared)
├── relationships.md       # Service dependency graph (tech-lead owns)
├── architecture/          # Patterns, per-service docs
│   ├── patterns.md
│   └── services/<name>.md
├── testing/               # Test patterns, quality gates
│   ├── patterns.md
│   ├── quality-gates.md
│   └── services/<name>.md
├── repos/                 # Per-repo manifests
│   └── <repo>/manifest.md
├── technologies/          # Tech radar, evaluations
│   ├── tech-radar.md
│   └── evaluations/<tech>.md
└── docs/                  # Documentation, guides
    ├── onboarding/
    └── api-guides/
```

## Knowledge Protocol (3-Tier Lookup)
1. **MCP queries first**: semantic_search, who_calls, who_injects, impact_analysis, trace_kafka_flow
2. **Local knowledge files**: Read from knowledge base directories
3. **Manual exploration**: grep/glob as last resort

## Task Routing
- **FAST-PATH**: Exact file+line+changes → hal-developer directly
- **INVESTIGATION**: "how does", "trace", "root cause" → hal-technical-lead
- **BUG-FIX**: tech-lead → developer → qa
- **FEATURE**: tech-lead → developer → qa
- **FLEET-WIDE**: "which repos", "audit all" → hal-explorer
- **DOCUMENTATION**: hal-doc-specialist

## Workflow Engine (hal-workflow)
- StateGraph DAG builder → YAML workflows → executable graphs
- Agent nodes create child OpenCode sessions
- Human-in-the-loop via interrupt/resume with checkpoint persistence
- Tools: run_workflow, cancel_workflow, list_workflows, resume_workflow, show_workflow
- Workflows: bug-fix, feature, investigate, performance-investigation

## Infrastructure
- Azure Kubernetes Service (AKS)
- Terraform for IaC
- Azure DevOps / GitLab CI for pipelines
- OpenTelemetry + Azure Monitor for observability
- ~95 repositories in hal_repos
