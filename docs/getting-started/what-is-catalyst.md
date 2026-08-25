---
title: What is Catalyst?
description: An architectural overview of the Catalyst stack — its three layers, the dependency rule that governs them, and what each layer is responsible for.
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
  implementation — the engine itself is untouched.
- **Portability.** No layer below the product references a browser or device API.
  The same synchronisation logic executes unchanged in a browser and in a React
  Native runtime.
- **Testability.** Because the lower layers depend on contracts rather than
  implementations, the engine can be exercised against an in-memory SQLite database
  with no device, browser, or server involved.
- **Independent versioning.** The engine and chassis release on their own cadence. A
  fix in synchronisation logic reaches every project through a version bump rather
  than a manual patch applied in each repository.

Inverting this direction — allowing the engine to reach upward into application
code — would forfeit all four. It is the one constraint the architecture does not
permit.

## What each layer provides

**Engine — `@8848digital/offline-kit`**

- The `OfflineDb` contract: the minimal database interface every platform driver implements.
- Inbound synchronisation: applies schema changes and row data from the server to the local database, resumable across interruptions.
- Outbound synchronisation: an outbox that queues locally created records and pushes them when connectivity allows, with ordered delivery, retry with backoff, and classification of transient versus permanent failures.
- Sequence and metadata bookkeeping, plus database lifecycle and health operations.

**Chassis — `@8848digital/catalyst`**

- A `fetch`-based API client that understands Frappe's response envelope and error codes, and handles expired sessions.
- Endpoint construction for Frappe's method-call URL convention.
- React Query integration: the shared client, provider, and the query and mutation hooks used for both local and remote reads.
- An authentication store factory and the login flow.
- `httpSyncTransport` — the concrete implementation of the engine's transport contract, backed by Frappe's synchronisation endpoints.

**Product — `reactant`**

- Feature modules organised as vertical slices, each owning its own data access, business rules, and hooks.
- Web and native applications, along with their component libraries.
- Design tokens shared across both platforms.
- Startup code that supplies each platform's concrete implementations to the layers below.

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

Next: [Quickstart](./quickstart.md) — a running application in minutes.
