# Claude-Flow Repository Improvement Map

> Generated: 2026-02-23
> Version analyzed: 2.7.47
> Branch: `claude/map-repo-structure-2DaRa`

---

## 1. Repo at a Glance

| Dimension | Current State |
|---|---|
| Language | TypeScript (ESM, Node ≥ 20) |
| Build tool | SWC (fast transpile), `pkg` for binaries |
| Test framework | Jest 29 + ts-jest |
| Source files | 376 `.ts` files (~130 k lines) |
| Test files | 79 test files (72 in `tests/`, 7 in `src/__tests__/`) |
| Docs | 50+ Markdown files in `docs/` — mostly release notes |
| CI | GitHub Actions: `ci.yml`, `verification-pipeline.yml`, `integration-tests.yml` |
| Key deps | `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `agentic-flow`, `ruv-swarm`, `flow-nexus`, `agentdb` (optional) |

---

## 2. Architecture Overview

```
src/
├── cli/               # Commander.js CLI, SPARC commands, init wizard
│   ├── commands/      # Per-feature command implementations
│   ├── init/          # Initialization & batch-tools
│   └── ui/            # Terminal UI components
├── core/              # Orchestrator, event bus, logger, config
├── swarm/             # SwarmCoordinator (3.2k lines), SPARC executor,
│                      #   strategies (auto/research/base), workers, optimizations
├── mcp/               # MCP server, tools registry, session manager, auth
├── memory/            # Advanced memory manager, swarm memory
├── agents/            # Agent manager profiles
├── neural/            # NeuralDomainMapper, pattern training
├── hive-mind/         # Hive-mind integration & queen coordination
├── verification/      # Rollback, security, telemetry, alert, dashboard
├── enterprise/        # Audit, analytics, cloud, security, deployment managers
├── coordination/      # Coordination manager
├── communication/     # Message bus (1.45k lines)
├── sdk/               # Session forking, query control
├── reasoningbank/     # Adaptive learning & trajectory storage
├── hooks/             # Pre/post task hooks
└── utils/             # Types, helpers, errors, paths
```

**Dominant design patterns:**
- Interface-first (`IOrchestrator`, `ISessionManager`, `IMemoryManager`, …)
- Dependency injection via constructors
- Event-driven via `EventEmitter` / internal `IEventBus`
- Circuit-breaker + retry utilities (`src/utils/helpers.ts`)
- ESM throughout with `.js` extensions on all imports

---

## 3. Improvement Areas (Priority-Ordered)

### 🔴 P1 — Critical / High-Impact

#### 3.1 Type Safety Debt — 2,226 `any` usages
- **Location:** spread across all `src/**/*.ts`
- **Risk:** Silently masks runtime errors; defeats strict-mode benefits
- **Fix:** Enable `ts-jest` `diagnostics: true`; replace `any` with typed interfaces starting in the highest-traffic modules:
  1. `src/swarm/coordinator.ts` (uses `(config as any).logging`)
  2. `src/mcp/claude-flow-tools.ts` (`orchestrator?: any`)
  3. `src/core/orchestrator.ts` agent/task casting

#### 3.2 Unimplemented TODOs in Core Paths
- **Files:**
  - `src/core/orchestrator.ts:1258,1306,1314,1370` — recovery strategies, periodic health checks, critical task processing
  - `src/mcp/auth.ts:283` — OAuth not implemented
  - `src/mcp/server.ts:250-251` — tool-specific metrics and error categorization stubs
  - `src/terminal/manager.ts:264` — memory bank link missing
- **Fix:** Convert each TODO to a tracked GitHub issue; implement or remove stubs

#### 3.3 4,682 Raw `console.*` Calls Instead of Logger
- **Risk:** Bypasses log-level control, breaks JSON-mode output, pollutes tests
- **Fix:** Replace with `this.logger.*` or the module-level `Logger` instance; add ESLint rule `no-console` for `src/`

---

### 🟡 P2 — Medium Impact

#### 3.4 File Size / CLAUDE.md Limit Violations
Files > 500 lines (project guideline):

| File | Lines |
|---|---|
| `src/cli/simple-cli.ts` | 3,305 |
| `src/swarm/coordinator.ts` | 3,244 |
| `src/verification/rollback.ts` | 2,119 |
| `src/memory/advanced-memory-manager.ts` | 2,014 |
| `src/resources/resource-manager.ts` | 1,912 |
| `src/agents/agent-manager.ts` | 1,735 |
| `src/neural/NeuralDomainMapper.ts` | 1,678 |
| `src/swarm/sparc-executor.ts` | 1,647 |
| `src/enterprise/audit-manager.ts` | 1,611 |
| `src/mcp/claude-flow-tools.ts` | 1,563 |

- **Fix:** Extract cohesive slices into sub-modules (e.g., `SwarmCoordinator` → `AgentLifecycle`, `TaskScheduler`, `MetricsCollector`)

#### 3.5 Test Coverage Gap
- 376 source files vs 79 test files → **~21% file coverage ratio**
- Many large modules (`enterprise/`, `neural/`, `verification/`, `communication/`) have zero dedicated test files
- CI runs tests as `continue-on-error: true` — failures are invisible
- **Fix:**
  1. Add unit tests for `enterprise/`, `neural/`, `communication/`
  2. Remove `continue-on-error` from CI test steps; fix underlying flakiness
  3. Set a minimum coverage threshold (e.g., 70%) in `jest.config.js`

#### 3.6 CLI Command Conversion Incomplete
- `src/cli/commands/agent.ts:272,280` — `terminate`, `info`, `start`, `restart`, `pool`, `health` not yet converted to Commander.js
- **Fix:** Complete the Commander.js migration for all agent sub-commands

#### 3.7 Docs Are Mostly Release Notes, Not Guides
- `docs/` contains 50+ release-note and report Markdown files
- Missing: architecture decision records (ADRs), onboarding guide, contribution guide
- **Fix:** Add `docs/architecture/ADR-*.md`, `docs/guides/CONTRIBUTING.md`, `docs/guides/ONBOARDING.md`

---

### 🟢 P3 — Low / Housekeeping

#### 3.8 Duplicate / Stale Bin Scripts
`bin/` has 9+ shell/JS files — several appear to be variants of the same entrypoint (`claude-flow`, `claude-flow-dev`, `claude-flow-pkg.js`, `claude-flow-swarm`, etc.)
- **Fix:** Audit `bin/` and consolidate; remove scripts not referenced in `package.json#bin`

#### 3.9 Build Steps Commented Out
`"prepack": "echo 'Alpha release - skipping build for now'"` — build is being skipped on pack
- **Risk:** Published package may not include latest compiled `dist/`
- **Fix:** Restore proper `prepack` to `npm run build` or document intentional skip

#### 3.10 `--legacy-peer-deps` in CI
- CI installs with `npm ci --legacy-peer-deps` — signals unresolved peer dependency conflicts
- **Fix:** Resolve peer dependency conflicts so clean install works without flag

#### 3.11 Python benchmark/ Not Integrated
`benchmark/` is a standalone Python suite that is never called from `npm test` or CI
- **Fix:** Either integrate benchmarks into CI or move to a clearly-labeled `benchmark/` skip list with a note

#### 3.12 `.research/` and `analysis-reports/` in Repo Root
These are generated artifacts that belong in `.gitignore`
- **Fix:** Add to `.gitignore`; move living docs to `docs/reports/`

#### 3.13 `tsconfig.json` `exclude` Conflict
`**/*.test.ts` is excluded from compilation but included in `include` via `src/**/*.ts` — creates ambiguity
- **Fix:** Normalize: include test files explicitly only in a `tsconfig.test.json`

---

## 4. Quick-Win Checklist

```
[ ] Add `no-console` ESLint rule to src/ config
[ ] Set `coverageThreshold: { global: { lines: 70 } }` in jest.config.js
[ ] Remove `continue-on-error: true` from CI test step
[ ] Fix prepack to run npm run build
[ ] Add `analysis-reports/` and `.research/` to .gitignore
[ ] Open GitHub issues for each TODO in critical paths (8 items)
[ ] Add tsconfig.test.json separating test compilation
```

---

## 5. Module Dependency Health

```
Core flow:
  CLI (commander)
    → Orchestrator (core)
      → SessionManager → TerminalManager, MemoryManager
      → SwarmCoordinator (swarm)
        → AutoStrategy / ResearchStrategy
        → DirectExecutor / SPARCExecutor
      → MCPServer (mcp)
        → ToolRegistry → ClaudeFlowTools, RuvSwarmTools
        → SessionManager (mcp) → Auth
      → MemoryManager (memory)
        → AdvancedMemoryManager
      → HiveMindIntegration (hive-mind)
      → NeuralDomainMapper (neural)

Enterprise features (separate concern, well-isolated):
  AuditManager, AnalyticsManager, SecurityManager,
  CloudManager, DeploymentManager (enterprise/)

Verification (cross-cutting):
  Rollback, Security, Telemetry, AlertManager,
  DashboardExporter (verification/)
```

**Observations:**
- Core dependencies are well-defined via interfaces — good for testability
- `swarm/coordinator.ts` is a god-class; highest priority for decomposition
- `enterprise/` is cleanly isolated and could become an optional plugin
- `verification/` concerns overlap with `enterprise/security-manager.ts` — consider merging

---

## 6. Recommended Roadmap

| Sprint | Focus | Files / Modules |
|---|---|---|
| 1 | Type safety + ESLint no-console | All `src/**/*.ts` (`any` → typed, console → logger) |
| 2 | Implement core TODOs | `orchestrator.ts`, `mcp/auth.ts`, `terminal/manager.ts` |
| 3 | Decompose god classes | `coordinator.ts`, `simple-cli.ts`, `claude-flow-tools.ts` |
| 4 | Test coverage ≥ 70% | `enterprise/`, `neural/`, `communication/`, `verification/` |
| 5 | CI hardening | Remove `continue-on-error`, fix `prepack`, resolve peer deps |
| 6 | Docs overhaul | ADRs, onboarding guide, contribution guide |
