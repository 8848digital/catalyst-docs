---
title: Architecture
description: The three layers of the Catalyst stack, the dependency rule that governs them, what crosses each boundary, and what enforces the direction.
---

Catalyst is an application stack for building **offline-first** products that run on
the web and on React Native from a single codebase, against a **Frappe** backend.

It is three layers with clearly separated responsibilities: two are distributed as versioned packages you install, and one is a repository you clone and own outright.

## The three layers

| Layer       | Package                      | Responsibility                                                                                                                                     |
| ----------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**  | `@8848digital/offline-kit`   | On-device persistence and two-way synchronisation. Defines the storage, transport, and connectivity **contracts**.                                 |
| **Chassis** | `@8848digital/catalyst`      | Backend integration: HTTP client, Frappe request/response conventions, authentication, server-state caching, and the concrete sync transport.      |
| **Product** | `reactant` (your repository) | Your application: feature modules, user interface, design tokens, and the startup code that supplies platform implementations to the layers below. |

The engine and chassis are published to a private registry and installed as
dependencies. Reactant is a template: you clone it once per project, and from that
point it is your codebase.

## The dependency rule

Dependencies point in one direction only:

```
product  →  chassis  →  engine
```

No layer references anything above it. The engine contains no reference to Frappe,
to HTTP, or to your domain; the chassis contains no reference to your application.

This single constraint produces four properties that the stack depends on:

- **Substitutability.** The engine synchronises through a transport _interface_, not
  a specific API. Targeting a different backend means writing one new transport
  implementation - the engine itself is untouched.
- **Portability.** No layer below the product references a browser or device API.
  The same synchronisation logic executes unchanged in a browser and in a React
  Native runtime.
- **Testability.** Because the lower layers depend on contracts rather than
  implementations, the engine can be exercised against an in-memory SQLite database
  with no device, browser, or server involved.
- **Independent versioning.** The engine and chassis release on their own cadence. A
  fix in synchronisation logic reaches every project through a version bump rather
  than a manual patch applied in each repository.

Inverting this direction - allowing the engine to reach upward into application
code - would forfeit all four. It is the one constraint the architecture does not
permit.

## What each layer provides

**Engine - `@8848digital/offline-kit`**

- The `OfflineDb` contract: the minimal database interface every platform driver implements.
- Inbound synchronisation: applies schema changes and row data from the server to the local database, resumable across interruptions.
- Outbound synchronisation: an outbox that queues locally created records and pushes them when connectivity allows, with ordered delivery, retry with backoff, and classification of transient versus permanent failures.
- Sequence and metadata bookkeeping, plus database lifecycle and health operations.

**Chassis - `@8848digital/catalyst`**

- A `fetch`-based API client that understands Frappe's response envelope and error codes, and handles expired sessions.
- Endpoint construction for Frappe's method-call URL convention.
- React Query integration: the shared client, provider, and the query and mutation hooks used for both local and remote reads.
- An authentication store factory and the login flow.
- `httpSyncTransport` - the concrete implementation of the engine's transport contract, backed by Frappe's synchronisation endpoints.

**Product - `reactant`**

- Feature modules organised as vertical slices, each owning its own data access, business rules, and hooks.
- Web and native applications, along with their component libraries.
- Design tokens shared across both platforms.
- Startup code that supplies each platform's concrete implementations to the layers below.

## What crosses each boundary

Every boundary is crossed by a **contract**: an interface defined by the inner layer and
implemented by an outer one.

| Contract | Defined by | Implemented by | Registered with |
|---|---|---|---|
| `OfflineDb` | engine | product - platform driver | `setOfflineDbOpener` |
| `ConnectivityProvider` | engine | product - platform driver | `setConnectivityProvider` |
| `OutboxAdapter` | engine | product - a feature slice | `registerOutboxAdapter` |
| `SyncTransport` | engine | **chassis** - `httpSyncTransport` | `setSyncTransport` |
| Base URL, token, app name, navigation, logout | chassis | product - boot wiring | `setBaseUrl`, `setGetToken`, … |
| Invalidation keys | chassis | product | `registerInvalidationKeys` |

The direction is consistent throughout: **the inner layer declares the shape, an outer
layer supplies the implementation, and the inner layer receives it at startup.** The
inner layer never imports the implementation - it holds a reference it was handed.

`SyncTransport` is the clearest case. The engine defines what synchronisation needs from
a server. The chassis, which knows Frappe, implements it. The engine has no idea Frappe
exists.

## What enforces the direction

Three mechanisms, in decreasing order of strictness.

**Absence of a dependency.** The engine cannot import the chassis, because the chassis is
not among its dependencies - the import would fail to resolve. Its manifest lists no
runtime dependency beyond a Babel helper, and every import in its shipped source is
relative. This is the strongest guarantee in the system, and it costs nothing to
maintain.

**Manifest declarations.** A package can only import what it declares. This bites in
practice: `@app/ui-web` does not declare `@app/core`, so a component there cannot import
a product hook until the dependency is added.

**Lint rules.** Within the product layer, ESLint confines `getOfflineDb` to a slice's
`data/**`, `usecases.ts`, `outbox.ts`, and `shared-domain/**`, and bans `axios` outright.
This governs layering *inside* the product layer, where no package boundary exists to do
the job.

One honest gap: nothing mechanically prevents the chassis from importing product code,
because the product is not a package the chassis could depend on. The chassis is
published; the product is not. Publication direction, rather than tooling, is what makes
that inversion impossible.

## What you write, and what you install

|                                            | Owned by you | Installed |
| ------------------------------------------ | ------------ | --------- |
| Feature logic, screens, components, tokens | ✓            |           |
| Startup and platform wiring                | ✓            |           |
| Persistence and synchronisation            |              | ✓         |
| API client, authentication, caching        |              | ✓         |

Application code should never modify the engine or chassis. When either needs to
change, the change belongs in that package and reaches your project as a release.

## Why three layers rather than one application

- **Reuse across projects.** Persistence and synchronisation are solved once. A new
  project installs both packages and begins with feature work.
- **Reuse across platforms.** Everything below the product layer is
  platform-neutral, so web and mobile share the substantial majority of their logic.
- **Contained change.** Each layer has an explicit surface. A modification to
  synchronisation cannot silently alter application behaviour, and application work
  cannot destabilise the engine.

---

Next: [Quickstart](../build/quickstart.md) - a running application in minutes.
