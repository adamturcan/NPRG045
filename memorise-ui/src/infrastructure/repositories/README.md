# Infrastructure Repositories

These local-storage backed repositories provide the persistence layer for Phase 3 prep Stage 2. They normalise data and hide legacy buckets so presentation code never touches `localStorage` directly.

## Implementations

| Repository | Key Strategy | Payload |
|------------|--------------|---------|
| `LocalStorageWorkspaceRepository` | `memorise.workspaces` (array) | Complete workspace objects (including spans, tags, translations). Migrates legacy `memorise.workspaces.v1[:username]` buckets. |
| `LocalStorageAnnotationRepository` | `memorise.annotations.<workspaceId>` | `{ userSpans, apiSpans, deletedApiKeys }` with convenience helpers for soft deletes. |
| `LocalStorageTagRepository` | `memorise.tags.<workspaceId>` | `{ user, api }` partitions to keep user-added tags separate from API suggestions. |

## Usage

Access instances through the provider factory so future DI work can swap implementations without touching callers:

```ts
import { getWorkspaceRepository } from "@/infrastructure/providers/repositories";

const repository = getWorkspaceRepository();
const workspaces = await repository.findByOwner("user-123");
```

Tests live alongside the implementations under `__tests__` and rely on Vitest’s jsdom `localStorage`. Clear storage in each test to ensure isolation:

```ts
beforeEach(() => {
  window.localStorage.clear();
});
```

When extending repositories, keep JSON parsing/writing inside `localStorageHelpers` to avoid duplicating error-handling logic.


