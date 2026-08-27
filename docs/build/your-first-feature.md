---
title: Build your first feature
description: Build a complete vertical slice - local database, repository, hook, component, and route - and see it running in the browser.
---

This tutorial builds a working feature end to end: a list of notes read from the
local database and rendered in the web application. It follows the same structure as
`packages/core/src/features/example`, the template's reference slice.

Allow roughly forty-five minutes. No backend is required.

## What you will build

A `/notes` route displaying records read from a local SQLite table, through the full
layering:

```
apps/web/app/notes/page.tsx          the route (Server Component)
  └── @app/ui-web  NotesList         the component ("use client")
        └── @app/core  useGetNotes   the hook
              └── notesRepo          the repository
                    └── data/local   SQL
```

Every layer has one responsibility, and each depends only on the layer beneath it.

## Before you start

You need a project generated from the [Quickstart](./quickstart.md), with
`pnpm --filter web dev` running successfully.

Use a recent Chrome, Edge, Firefox, or Safari. The local database is SQLite compiled
to WebAssembly running over the Origin Private File System, which requires
cross-origin isolation. The template's `next.config.ts` already sends the required
headers in development. Browser shields and privacy extensions can still block it.

## Step 1 - Create the slice and its type

Create `packages/core/src/features/notes/notes.types.ts`:

```ts title="packages/core/src/features/notes/notes.types.ts"
/** Row of the local `note` table. */
export interface Note {
  id: string;
  title: string;
  body: string;
  created_at: string;
}
```

A feature's own types live in its slice, never in the global `types/` barrel. That
barrel is reserved for types genuinely shared across several features, and the linter
enforces the distinction.

## Step 2 - The local data source

Create `packages/core/src/features/notes/data/local.ts`:

```ts title="packages/core/src/features/notes/data/local.ts"
import { getOfflineDb } from '@8848digital/offline-kit';
import type { Note } from '../notes.types';

const SEED: readonly Note[] = [
  { id: 'n1', title: 'First note', body: 'Created locally, with no server involved.', created_at: '2026-01-01T09:00:00Z' },
  { id: 'n2', title: 'Second note', body: 'Read straight out of the on-device database.', created_at: '2026-01-02T09:00:00Z' },
];

/**
 * TUTORIAL SCAFFOLDING - not a production pattern. See the note below.
 * Creates the table and inserts sample rows. Both statements are idempotent,
 * so running this repeatedly is safe.
 */
export async function bootstrapNotesTable(): Promise<void> {
  const db = await getOfflineDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS note (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  for (const note of SEED) {
    await db.exec('INSERT OR REPLACE INTO note (id, title, body, created_at) VALUES (?, ?, ?, ?)', [note.id, note.title, note.body, note.created_at]);
  }
}

/** Reads every note, newest first. */
export async function getNotes(): Promise<Note[]> {
  const db = await getOfflineDb();
  return db.all<Note>('SELECT id, title, body, created_at FROM note ORDER BY created_at DESC');
}
```

:::warning[Tutorial scaffolding]

`bootstrapNotesTable` exists only so this tutorial runs without a backend.

In a real deployment the application never creates its own tables. The server sends
table definitions as sequenced data-definition statements, and inbound
synchronisation applies them to the local database in order - see
[Architecture](../how-it-works/architecture.md). Delete this function once your tables
arrive from the server.

:::

This file sits in the slice's `data` directory, one of the few locations permitted to
import `getOfflineDb` and run SQL. Step 10 demonstrates what happens when that rule
is broken.

## Step 3 - The repository

Create `packages/core/src/features/notes/repo.ts`:

```ts title="packages/core/src/features/notes/repo.ts"
import type { Note } from './notes.types';
import { bootstrapNotesTable, getNotes } from './data/local';

/**
 * The single place that decides local versus remote. Hooks call the repository
 * and never touch SQL or HTTP directly.
 */
export const notesRepo = {
  list: async (): Promise<Note[]> => {
    await bootstrapNotesTable(); // tutorial scaffolding - remove for real data
    return getNotes();
  },
};
```

The repository is the seam that lets a slice switch between local and remote without
anything above it changing. Step 11 exercises that.

## Step 4 - The hook

Create `packages/core/src/features/notes/hooks.ts`:

```ts title="packages/core/src/features/notes/hooks.ts"
import type { Note } from './notes.types';
import { toLegacyShape, type LegacyQueryShape, useLocalQuery } from '@8848digital/catalyst';
import { notesRepo } from './repo';

export function useGetNotes(): LegacyQueryShape<Note[]> {
  return toLegacyShape(
    useLocalQuery({
      queryKey: ['notes'],
      queryFn: () => notesRepo.list(),
    }),
  );
}
```

`useLocalQuery` is used rather than React Query's `useQuery` for two reasons: local
reads must never be served stale, and they must not be paused while the device is
offline. `toLegacyShape` flattens the result to `{ data, isLoading, isError, error }`.

## Step 5 - Export the slice

Create the slice barrel, `packages/core/src/features/notes/index.ts`:

```ts title="packages/core/src/features/notes/index.ts"
export type { Note } from './notes.types';
export { useGetNotes } from './hooks';
export { notesRepo } from './repo';
```

Add the hook to `packages/core/src/hooks/index.ts`:

```ts title="packages/core/src/hooks/index.ts"
export { useGetExamples } from '../features/example';
export { useGetNotes } from '../features/notes';
```

And the type to `packages/core/src/index.ts`, alongside the existing exports:

```ts title="packages/core/src/index.ts"
export type { Note } from './features/notes';
```

## Step 6 - Let the component library use the core package

`@app/ui-web` does not yet depend on `@app/core`, so the hook cannot be imported
there. Add the dependency to `packages/ui-web/package.json`:

```json title="packages/ui-web/package.json"
"dependencies": {
  "@app/core": "workspace:*",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.469.0",
  "tailwind-merge": "^2.5.2"
}
```

Then re-link the workspace:

```bash
pnpm install
```

## Step 7 - The component

Create `packages/ui-web/src/components/NotesList.tsx`:

```tsx title="packages/ui-web/src/components/NotesList.tsx"
'use client';

import { useGetNotes } from '@app/core';

export function NotesList() {
  const { data, isLoading, isError, error } = useGetNotes();

  if (isLoading) return <p className="text-sm text-text-muted">Loading notes…</p>;
  if (isError) return <p className="text-sm text-error">{error}</p>;
  if (!data?.length) return <p className="text-sm text-text-muted">No notes yet.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {data.map((note) => (
        <li key={note.id} className="rounded-md border border-border-default bg-surface-canvas p-4 shadow-sm">
          <h2 className="text-md font-semibold text-text-primary">{note.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
```

Export it from `packages/ui-web/src/index.ts`:

```ts title="packages/ui-web/src/index.ts"
export { NotesList } from './components/NotesList';
```

Two details matter here. The `"use client"` directive is required because the
component uses a hook; without it, Next.js would attempt to render it on the server.
And every class name resolves to a design token - `text-text-primary`,
`bg-surface-canvas`, `rounded-md` - rather than a raw value, so rebranding means
editing `packages/core/src/tokens/index.ts` and nothing else.

## Step 8 - The route

Create `apps/web/app/notes/page.tsx`:

```tsx title="apps/web/app/notes/page.tsx"
import { NotesList } from '@app/ui-web';

export const metadata = { title: 'Notes' };

export default function NotesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="text-xl font-bold text-text-primary">Notes</h1>
      <NotesList />
    </main>
  );
}
```

This is a Server Component. It owns routing, layout, and metadata, then renders the
client component. The division is deliberate: `apps/web/app/**` is the server shell
and has no native counterpart, whereas `NotesList` is pure React and could be given a
native twin.

## Step 9 - Run it

```bash
pnpm --filter web dev
```

Open **http://localhost:3000/notes**. Two notes render, read from SQLite in the
browser.

Reload the page. The rows persist, because they are in the on-device database rather
than in component state.

## Step 10 - What the linter prevents

The layering rules are enforced, not merely documented. Prove it.

Temporarily add this import to `hooks.ts`, where it does not belong:

```ts
import { getOfflineDb } from '@8848digital/offline-kit';
```

Then run:

```bash
pnpm lint
```

The rule fails with an explanation rather than a bare rule name:

```
Raw DB access (getOfflineDb) is only allowed in a feature data source
(features/*/data), a use-case (usecases.ts), an outbox adapter (outbox.ts), or a
shared-domain helper. Hooks, repos, and the chassis must delegate to those - they
must not run SQL directly.
```

Remove the import again. Two related rules are enforced the same way: `axios` is
banned project-wide in favour of the client from `@8848digital/catalyst`, and feature
files may not import the global `types/` barrel.

## Step 11 - Taking the slice online

The slice currently reads locally. Adding a remote source touches three files, and
neither the hook nor the component is among them.

Register the endpoint in `packages/core/src/api/endpoints.ts`:

```ts title="packages/core/src/api/endpoints.ts"
export const endpoints = {
  example: {
    getList: buildEndpoint('v1', 'example', 'get_list', APP),
  },
  notes: {
    getList: buildEndpoint('v1', 'notes', 'get_list', APP),
  },
} as const;
```

Add `packages/core/src/features/notes/data/remote.ts`:

```ts title="packages/core/src/features/notes/data/remote.ts"
import { api } from '@8848digital/catalyst';
import { endpoints } from '../../../api/endpoints';
import type { Note } from '../notes.types';

export const notesRemote = {
  getList: (): Promise<Note[]> => api.get<Note[]>(endpoints.notes.getList),
};
```

Then change the repository - the only file above the data layer that moves:

```ts title="packages/core/src/features/notes/repo.ts"
import type { Note } from './notes.types';
import { getConnectivityProvider } from '@8848digital/offline-kit';
import { notesRemote } from './data/remote';
import { getNotes } from './data/local';

export const notesRepo = {
  list: async (): Promise<Note[]> => (getConnectivityProvider().isOnline() ? notesRemote.getList() : getNotes()),
};
```

`hooks.ts`, `NotesList.tsx`, and `page.tsx` are untouched. That containment is the
practical return on the layering.

Running this against real data requires a Frappe site exposing the endpoint.

## Step 12 - The native twin

Steps 1 through 5 are already shared. `@app/core` imports no browser API, so
`useGetNotes` runs unchanged on React Native. Only the component layer differs.

A native equivalent lives in `packages/ui-native/src/components/NotesList.tsx`, built
from `View`, `Text`, and `FlatList`, styled through `StyleSheet.create` using
`rnTokens` from `@app/core/tokens/rn-styles` - the same token values the web classes
resolve to. Register the screen in `apps/native/src/navigation/RootNavigator.tsx`.

Unlike `@app/ui-web`, `@app/ui-native` already declares `@app/core` as a dependency,
so no equivalent of step 6 is needed on the native side.

The data path - repository, hook, SQL, synchronisation - is not rewritten. That is
the return on keeping `@app/core` free of platform APIs.

## What you built

| Layer | File | Responsibility |
|---|---|---|
| Type | `notes.types.ts` | The slice's own domain type |
| Data | `data/local.ts` | SQL - the only layer permitted to touch the database |
| Repository | `repo.ts` | Chooses local or remote |
| Hook | `hooks.ts` | Exposes the data to React |
| Component | `ui-web/NotesList.tsx` | Renders it, using tokens |
| Route | `app/notes/page.tsx` | Server shell: routing and metadata |

Copy this structure for every feature. `packages/core/src/features/example` remains in
the template as a reference.

---

Related: [The workspace](./the-workspace.md) for the wider repository
tour, and [Architecture](../how-it-works/architecture.md) for the architecture these rules
come from.
