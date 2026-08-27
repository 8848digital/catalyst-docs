---
title: What am I looking at?
description: A tour of the generated workspace - the two applications, the three shared packages, where each kind of change belongs, and what the startup files do.
---

The Quickstart produced a running application. This page explains what the repository
contains, so that the next change can be made in the right place.

## The workspace at a glance

The project is a pnpm workspace containing two applications and three shared
packages.

```
apps/
  web/                      Next.js application (App Router)
    app/                    the server shell - routing, layout, metadata
    src/offline/            web platform drivers: database, connectivity, geolocation
    src/stores/             the authentication store instance
    public/sqlite/          SQLite WebAssembly assets, copied in before dev and build
    next.config.ts          cross-origin isolation headers, package transpilation
    tailwind.config.ts      consumes the design tokens
  native/                   React Native application (bare, not Expo)
    src/bootstrap.ts        startup registrations
    src/offline/            native platform drivers
    src/screens/            screens
    src/navigation/         the navigator
    android/  ios/          native projects, under version control

packages/
  core/                     @app/core - platform-neutral application code
    src/features/           vertical feature slices
    src/tokens/             design tokens
    src/api/                business endpoint registry
    src/types/              domain types shared across features
    src/hooks/              the public hook barrel
  ui-web/                   @app/ui-web - web components
  ui-native/                @app/ui-native - native components
```

Both UI packages ship empty. That is deliberate: components are product decisions, and
the template does not presume a design system.

## The two applications

**`apps/web`** is a Next.js application using the App Router. Everything under
`apps/web/app/**` is the **server shell**: routing, layout, metadata, and data
loading, rendered as Server Components by default. The server shell has no native
counterpart and is never migrated.

**`apps/native`** is a bare React Native application. The `android/` and `ios/`
directories are real native projects held in version control, which is what makes
release configuration - signing, bundle identifiers, permissions - a direct edit
rather than a build-service setting.

Interface code intended to run on both platforms does not belong in either
application. It belongs in `@app/ui-web` and `@app/ui-native`, which are free of
server-only APIs and can therefore be rendered by either host.

## The three shared packages

**`@app/core`** holds everything that is not platform-specific: feature slices, domain
types, the business endpoint registry, and design tokens. It must never import
`react-native`, `react-dom`, Tailwind, or any browser API. This restriction is what
allows the same feature logic to serve both applications.

Features inside it are organised as **vertical slices**. Each slice owns its data
access, its business rules, and its hooks, with dependencies running in one direction:

```
hooks.ts  →  repo.ts  →  data/local.ts   (SQL)
                      →  data/remote.ts  (HTTP)
```

`packages/core/src/features/example` is the reference implementation. It is intended
to be read and copied.

**`@app/ui-web`** and **`@app/ui-native`** hold the component libraries for each
platform. They are separate packages rather than one because the rendering primitives
differ; they stay aligned because both consume the same tokens.

## Where a change goes

| Change | Location |
|---|---|
| A new web route | `apps/web/app/<route>/page.tsx` |
| A new native screen | `apps/native/src/screens/`, registered in `RootNavigator.tsx` |
| Feature logic, data access, hooks | `packages/core/src/features/<name>/` |
| A web component | `packages/ui-web/src/components/` |
| A native component | `packages/ui-native/src/components/` |
| Colour, spacing, typography, radius | `packages/core/src/tokens/index.ts` |
| A business API endpoint | `packages/core/src/api/endpoints.ts` |
| A type used by one feature | that slice's `<name>.types.ts` |
| A type used by several features | `packages/core/src/types/index.ts` |
| A startup registration | `apps/web/app/providers.tsx` or `apps/native/src/bootstrap.ts` |

## The startup files

Each application supplies the engine and chassis with its platform-specific
implementations exactly once, at startup:

- Web - `apps/web/app/providers.tsx`, inside an effect so it runs in the browser only
- Native - `apps/native/src/bootstrap.ts`, imported before the app registers

Both register the same set. Only the implementations differ:

| Registration | Web | Native |
|---|---|---|
| `setApiApp` | the Frappe app name | the Frappe app name |
| `setBaseUrl` | `process.env.NEXT_PUBLIC_API_BASE_URL` | `Config.API_BASE_URL` |
| `setGetToken` / `setLogout` | auth store backed by `localStorage` | auth store backed by `AsyncStorage` |
| `setNavigate` | `router.push` | not registered - clearing the token flips the navigator |
| `setOfflineDbOpener` | SQLite WebAssembly over OPFS | `react-native-sqlite-2` |
| `setSyncTransport` | `httpSyncTransport` | `httpSyncTransport` |
| `setConnectivityProvider` | browser online and offline events | NetInfo |
| `setGeolocationProvider` | browser geolocation | `@react-native-community/geolocation` |
| `outboundSync.start()` | yes | yes |

Reading these two files side by side is the fastest way to understand how the stack
is assembled. A missing registration produces an explicit error naming the seam,
rather than a silent failure.

## Rules the linter enforces

Three architectural rules in `eslint.config.js` are enforced rather than merely
documented.

**Database access is confined to the data layer.** Importing `getOfflineDb` is
permitted only in `features/*/data/**`, `usecases.ts`, `outbox.ts`, and
`shared-domain/**`. Hooks and repositories must delegate downward. The rule polices
the import because SQL cannot be run without it.

**`axios` is banned.** The project uses the `fetch`-based client from
`@8848digital/catalyst`, which applies the response envelope, authentication header,
and session handling. A second HTTP client would bypass all three.

**A feature's own types stay in its slice.** Feature files may not import the global
`types/` barrel, which is reserved for types genuinely shared across features.

Each rule carries an explanatory message, so a violation reports the reason rather
than only the rule name.

## Supporting configuration

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Workspace members and build-script permissions |
| `turbo.json` | Task graph for `dev`, `build`, `lint`, and `test` across all packages |
| `tsconfig.base.json` | Shared compiler options; `strict` is on |
| `eslint.config.js` | Code style plus the architectural rules above |
| `commitlint.config.js`, `.husky/` | Conventional commit enforcement and pre-commit formatting |
| `.npmrc` | Routes the `@8848digital` scope to its registry. Contains no token. |

---

Next: [Your first feature](./your-first-feature.md) - a complete vertical
slice, from the database to the screen.
