---
title: Troubleshooting
description: The errors a Catalyst project actually produces, what causes each, and how to fix it.
---

Grouped by where you hit them. Each entry gives the error as it appears, the cause, and
the fix.

## Installing

### `E401` or `Unauthorized`

```
ERR_PNPM_FETCH_401  GET https://npm.pkg.github.com/@8848digital%2Foffline-kit
```

The `@8848digital` packages are private. Either no token is configured, it has expired, or
it lacks the `read:packages` scope.

Add a token to your **user-level** `~/.npmrc`, not the project's:

```ini title="~/.npmrc"
@8848digital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_READ_TOKEN
```

Then confirm your account has access to the organisation's packages.

### `Cannot read properties of null (reading 'matches')`

You ran `npm install`. This workspace is pnpm-only.

npm's resolver walks pnpm's symlink store under `node_modules/.pnpm/` and crashes on a
link it cannot resolve. It fails while planning, so it does no damage - but it will never
succeed.

```bash
pnpm install
```

### `ERR_PNPM_IGNORED_BUILDS`

```
Ignored build scripts: @swc/core, core-js
```

pnpm 10 and later block dependency build scripts until each is explicitly allowed or
denied. The non-zero exit can then fail whatever ran the install.

Decide each one in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@swc/core': true
  core-js: false
```

The `pnpm.onlyBuiltDependencies` field in `package.json` is **not** read by pnpm 10+.

## Running the web app

### Port 3000 already in use

The docs site and reactant's web app both default to 3000.

```bash
pnpm --filter web dev -- --port 3001
```

### Styles missing in production but fine locally

A package containing Tailwind classes is not in the `content` array, so its classes are
purged from the production build only.

```ts title="apps/web/tailwind.config.ts"
content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
```

Add the new package's path there.

### `Module not found: @app/core` inside `ui-web`

`@app/ui-web` is the one package in the workspace that does not declare `@app/core`. Add
it and re-run `pnpm install`:

```json title="packages/ui-web/package.json"
"dependencies": { "@app/core": "workspace:*" }
```

### `Cannot find module '@repo/core'`

Generated code carrying the dev kit's placeholder scope. This project uses `@app/core`,
`@app/ui-web`, `@app/ui-native`, and `@8848digital/offline-kit`.

Replace the specifier. See [Trust and verify](./ai/trust-and-verify.md).

## The local database

### `Offline mode requires the Origin Private File System`

The browser does not support OPFS. Use a recent Chrome, Edge, Firefox, or Safari.

### `Offline mode requires cross-origin isolation`

```
The page must be served with Cross-Origin-Opener-Policy: same-origin and
Cross-Origin-Embedder-Policy: require-corp.
```

SQLite over OPFS uses `SharedArrayBuffer`, which requires those two headers.

- **In development**, `next.config.ts` already sends them. If you still see this, a browser shield or privacy extension is blocking it. Brave in particular needs Shields disabled for localhost.
- **In production**, your own server, CDN, or hosting platform must send them too. This is the most common cause of "works locally, breaks on deploy" for offline features.

### `Offline DB opener not registered`

```
Call setOfflineDbOpener() at app boot with your platform-specific openOfflineDb
```

A startup seam was never filled. The same applies to `setSyncTransport`.

Both are registered in `apps/web/app/providers.tsx` and `apps/native/src/bootstrap.ts`.
The error names the missing seam, which is deliberate - see
[The workspace](./build/the-workspace.md).

### `no such table: <name>`

The table has not been created yet. It arrives from the server during inbound schema
sync, so before the first successful sync it does not exist.

The engine treats this as "nothing to do" for outbox counting and stays quiet. If you see
it from a feature query, either the first sync has not run or the backend does not send
that table.

In the tutorial this is expected, and the seeding step creates the table locally.

### `cannot start a transaction within a transaction`

Two transactions overlapped. Both drivers serialise transactions with a mutex, so this
usually means a plain `exec()` ran while a `transaction()` was open, and landed inside it.

Any write that can race a transaction must itself go through `transaction()`.

## Synchronisation

### `Sequence N does not exist. Maximum available sequence is M.`

**This is not an error.** It is how the data endpoint signals the end of the pages. The
engine matches on that message and stops cleanly.

If you see it in a log, no action is needed.

### Records stay pending and never push

Work through it in order:

1. **Is the adapter registered?** `registerOutboxAdapter(...)` must run in both boot files, and **before** `outboundSync.start()`. An unregistered adapter is never drained, silently.
2. **Is the invalidation key present?** Missing keys do not block the push, but the screen will not refresh, which looks the same to a user.
3. **Check `lastError`** via `useOutboxStatus()`.
4. **Check `needsAttentionCount`.** After five permanent failures a record is flagged. Permanent means the server processed and rejected it, usually a field mapping mismatch in `buildPayload`.

### Duplicate records on the server

`record_id` is not stable. It must be the local row's id, generated once at write time and
never regenerated on retry - that is the server's deduplication key.

### Screen shows stale data after navigating back

Native only. The stack navigator keeps screens mounted, so nothing remounts and re-reads.

`refreshLocalData()` on navigation transitions handles this and is wired in
`apps/native/App.tsx`. If a screen is stale, check that wiring is intact.

## Lint and build

### `Raw DB access (getOfflineDb) is only allowed in...`

Working as intended. `getOfflineDb` belongs in `features/*/data/**`, `usecases.ts`,
`outbox.ts`, or `shared-domain/**`.

A hook or repository must delegate downward rather than run SQL.

### `This project uses the fetch-based apiClient from @8848digital/catalyst, not axios`

Also intended. Use the `api` client, which applies the response envelope, the
authentication header, and 401 handling.

### `A feature's own domain types live in its slice`

Feature files may not import the global `types/` barrel. Put the type in the slice's own
`<name>.types.ts`; the global barrel is only for types shared across several features.

## Native

### The app crashes rendering text

A bare string outside a `<Text>` element. React Native throws rather than warning.

```tsx
<View>Hello</View>                  // crashes
<View><Text>Hello</Text></View>     // correct
```

Watch interpolated values, conditional text, and `{' '}` spacers.

### A release build is rejected as unsigned

```
WARNING: No release keystore configured (keystore.properties / REACTANT_UPLOAD_* env).
```

The release variant is unsigned by default and deliberately does not fall back to the
debug keystore. See [Release](./ship-to-native/release.md).

### Location works on iOS, silently fails on Android

The Android manifest ships with the location permissions commented out. Uncomment the
ones you need.

### Metro cannot resolve `@app/core`

`watchFolders` has been removed from or broken in `metro.config.js`. Metro then stops
watching the workspace packages and fails without a clear message.

## Still stuck

Two checks worth running before asking:

```bash
pnpm lint        # the layering rules report themselves with explanations
pnpm build       # a type error is usually more specific than a runtime symptom
```

And for the database specifically, `runOfflineDbHealthCheck()` exercises the full contract

- open, query, write, read back, transaction - and reports which step failed.
