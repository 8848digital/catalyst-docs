---
title: Your first feature
description: Generate a vertical slice with the feature-slice skill, understand what it produced, and wire it to a screen.
---

This tutorial builds a working feature end to end: a list of notes read from the local
database and rendered in the web application.

The data layer is **generated**, not typed by hand. That is how features are built on
Catalyst, and it is also the fastest way to learn the conventions - you read a correct
example instead of assembling one.

Allow about forty-five minutes. No backend is required.

:::note[Following along without the dev kit]

The generator is an internal Claude Code plugin. Every file it produces is shown in full
below, so the tutorial works whether you run the command or type the files yourself.

:::

## What you will build

A `/notes` route reading from a local SQLite table, through the full layering:

```
apps/web/app/notes/page.tsx          the route (Server Component)
  └── @app/ui-web  NotesList         the component ("use client")
        └── @app/core  useGetNotes   the hook
              └── notesRepo          the repository
                    └── data/local   SQL
```

Each layer has one responsibility and depends only on the layer beneath it.

## Before you start

A project from the [Quickstart](./quickstart.md), with `pnpm --filter web dev` running.

Use a recent Chrome, Edge, Firefox, or Safari. The local database is SQLite compiled to
WebAssembly over the Origin Private File System, which needs cross-origin isolation. The
template's `next.config.ts` already sends the headers in development; browser shields can
still block it.

## Step 1 - Generate the slice

```
/feature-slice new slice notes
```

The skill asks what the feature holds. Describe the shape, or paste a real API response
and it will derive the types from that:

> A note has an id, a title, a body, and a created_at timestamp.

It scaffolds `packages/core/src/features/notes/` with the layering already correct.

## Step 2 - Read what it produced

This is the part worth slowing down for. Each file has one job, and the direction of
dependency between them is the entire convention.

### The type

```ts title="packages/core/src/features/notes/notes.types.ts"
export interface Note {
  id: string;
  title: string;
  body: string;
  created_at: string;
}
```

Feature-local, never the global `types/` barrel - that is reserved for types shared
across several features, and the linter enforces the distinction. Field names mirror the
backend, so they stay snake_case.

### The local data source

```ts title="packages/core/src/features/notes/data/local.ts"
import { getOfflineDb } from '@8848digital/offline-kit';
import type { Note } from '../notes.types';

export async function getNotes(): Promise<Note[]> {
  const db = await getOfflineDb();
  return db.all<Note>('SELECT id, title, body, created_at FROM note ORDER BY created_at DESC');
}
```

The `data` directory is one of the few places allowed to import `getOfflineDb` and run
SQL. Step 8 shows what happens when that rule is broken.

### The repository

```ts title="packages/core/src/features/notes/repo.ts"
import type { Note } from './notes.types';
import { getNotes } from './data/local';

export const notesRepo = {
  list: (): Promise<Note[]> => getNotes(),
};
```

The single place that decides local versus remote. Hooks call the repository and never
touch SQL or HTTP. Step 9 exercises why that matters.

### The hook

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

`useLocalQuery` rather than React Query's `useQuery`, for two reasons: local reads must
never be served stale, and they must not be paused while the device is offline.
`toLegacyShape` flattens the result to `{ data, isLoading, isError, error }`.

### The barrels

```ts title="packages/core/src/features/notes/index.ts"
export type { Note } from './notes.types';
export { useGetNotes } from './hooks';
export { notesRepo } from './repo';
```

And the slice is surfaced from the package:

```ts title="packages/core/src/hooks/index.ts"
export { useGetExamples } from '../features/example';
export { useGetNotes } from '../features/notes';
```

## Step 3 - Review it

Generated code is reliable at conventions and needs checking wherever judgement was
involved. Three things, every time:

1. **Import specifiers.** The kit currently emits `@repo/core` where this project uses
   `@app/core`, and `@repo/offline-kit` where it uses `@8848digital/offline-kit`.
   TypeScript flags these as unresolved, so they fail loudly - but correct them first.
2. **The types against reality.** They mirror whatever you described or pasted. If the
   sample was partial, the types are wrong in a way that still compiles.
3. **The SQL.** Read the `WHERE` clause and the ordering. Valid SQL can still select the
   wrong rows.

[Trust and verify](../ai/trust-and-verify.md) has the full split of what to accept and
what to check.

## Step 4 - Give the table something to read

The generated `data/local.ts` queries a `note` table that does not exist yet. In a real
project it arrives from the server. Here, create and seed it:

```ts title="packages/core/src/features/notes/data/local.ts"
const SEED: readonly Note[] = [
  { id: 'n1', title: 'First note', body: 'Created locally, with no server involved.', created_at: '2026-01-01T09:00:00Z' },
  { id: 'n2', title: 'Second note', body: 'Read straight out of the on-device database.', created_at: '2026-01-02T09:00:00Z' },
];

/** TUTORIAL SCAFFOLDING - see the note below. Both statements are idempotent. */
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
```

Call it from the repository:

```ts title="packages/core/src/features/notes/repo.ts"
export const notesRepo = {
  list: async (): Promise<Note[]> => {
    await bootstrapNotesTable(); // tutorial scaffolding - remove for real data
    return getNotes();
  },
};
```

:::warning[Tutorial scaffolding]

`bootstrapNotesTable` exists only so this tutorial runs without a backend, which is why
the generator did not produce it.

In a real deployment the application never creates its own tables. The server sends table
definitions as sequenced data-definition statements, and inbound synchronisation applies
them in order - see [Offline sync](../how-it-works/offline-sync.md). Delete this function
once your tables arrive from the server.

:::

## Step 5 - Let the component library use the core package

`@app/ui-web` does not declare `@app/core`. Every other package in the workspace does;
this one is the exception, so a component there cannot import a product hook until you
add it:

```json title="packages/ui-web/package.json"
"dependencies": {
  "@app/core": "workspace:*",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.469.0",
  "tailwind-merge": "^2.5.2"
}
```

Then `pnpm install`.

## Step 6 - The component

Components are normally generated too, by the `web-component` skill. That skill is
**Figma-first**: it pulls a design node, extracts its values, and maps them to tokens.
This tutorial has no Figma node, so there is nothing to extract - write this one by hand.

Knowing when a skill does not apply is part of using them well.

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

`'use client'` is required because it uses a hook. Every class name resolves to a design
token rather than a raw value - see [Components and tokens](./components-and-tokens.md).

Export it from the barrel:

```ts title="packages/ui-web/src/index.ts"
export { NotesList } from './components/NotesList';
```

## Step 7 - The route

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

This is a Server Component. It owns routing and metadata, then renders the client
component. `apps/web/app/**` is the server shell and has no native counterpart, whereas
`NotesList` is pure React and could be given a native twin.

Run it:

```bash
pnpm --filter web dev
```

Open **http://localhost:3000/notes**. Two notes render, read from SQLite in the browser.
Reload - they persist, because they live in the on-device database rather than component
state.

## Step 8 - What the linter prevents

The layering rules are enforced, not merely documented. This is also why the generator
produces correct code: the rules it follows are the rules that fail the build.

Temporarily add this import to `hooks.ts`, where it does not belong:

```ts
import { getOfflineDb } from '@8848digital/offline-kit';
```

Then run `pnpm lint`:

```
Raw DB access (getOfflineDb) is only allowed in a feature data source
(features/*/data), a use-case (usecases.ts), an outbox adapter (outbox.ts), or a
shared-domain helper. Hooks, repos, and the chassis must delegate to those - they
must not run SQL directly.
```

Remove it again. Two related rules work the same way: `axios` is banned in favour of the
client from `@8848digital/catalyst`, and feature files may not import the global `types/`
barrel.

## Step 9 - Taking the slice online

The generator already produced `data/remote.ts` and its endpoint entry. Going online is
therefore a change to **one** file - the repository:

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

Running it against real data needs a Frappe site exposing the endpoint.

## Step 10 - The native twin

Steps 1 to 5 are already shared. `@app/core` imports no browser API, so `useGetNotes`
runs unchanged on React Native. Only the component layer differs, and it is ported rather
than rewritten:

```
port NotesList from ui-web to ui-native
```

The `web-to-native` skill mirrors the props verbatim, maps HTML elements to RN
primitives, converts Tailwind classes to `rnTokens`, and leaves `@app/core` untouched.
Unlike `@app/ui-web`, `@app/ui-native` already declares `@app/core`, so no equivalent of
step 5 is needed.

The data path - repository, hook, SQL, synchronisation - is not rewritten. That is the
return on keeping `@app/core` free of platform APIs.

## What you built

| Layer | File | Responsibility | Source |
|---|---|---|---|
| Type | `notes.types.ts` | The slice's own domain type | generated |
| Data | `data/local.ts` | SQL - the only layer allowed to touch the database | generated |
| Repository | `repo.ts` | Chooses local or remote | generated |
| Hook | `hooks.ts` | Exposes the data to React | generated |
| Component | `ui-web/NotesList.tsx` | Renders it, using tokens | hand-written (no Figma) |
| Route | `app/notes/page.tsx` | Server shell: routing and metadata | hand-written |

The pattern holds for every feature: **generate the data path, review it, then build the
interface on top.**

---

Related: [The workspace](./the-workspace.md) for where each kind of change belongs, and
[The skills](../ai/the-skills.md) for what else the dev kit generates.
