---
title: Why Catalyst
description: The problem Catalyst was built to solve, what it changes about how applications get delivered, and where it fits.
---

Catalyst is the framework 8848 Digital uses to build offline-first web and mobile
applications on a Frappe backend.

This page explains why it exists and what it changes. It assumes no prior knowledge of
the stack and contains no code.

:::note

Catalyst is used internally at 8848 Digital, and its packages are published to a private
registry. This site is published so the approach is readable, not because the framework
is installable from outside the organisation.

:::

## The situation it was built for

8848 delivers a lot of applications that resemble one another:

- a **Frappe** backend
- users working in the field, frequently without a reliable connection
- the same application required on **both** the web and a phone

Each of those projects independently rebuilt the same foundation - on-device storage,
two-way synchronisation, a queue for records created offline, an API client,
authentication, and a project structure.

The wasted time was the smallest of the costs.

**Standards diverged.** Web and mobile were built by different people, in different
repositories, to different conventions. A developer moving between them started over.

**Fixes did not travel.** A synchronisation bug found on one project was fixed on that
project. Other projects carried the same bug until someone hit it independently.

**Native work set the pace.** The web has a fast loop: save, refresh, read the console,
inspect the network tab. Mobile has emulators, device builds, and none of that tooling.
Demos arrived late because the first thing anyone could look at was a native build.

**Knowledge concentrated in individuals.** With two developers on a project and no
shared conventions, one of them being unavailable could stall a release.

## What Catalyst changes

Three changes, and they only work together.

### The foundation became a dependency

Storage, synchronisation, the API client, and authentication live in two versioned
packages that projects install rather than write.

The synchronisation engine is deliberately self-contained - it imports nothing at all,
not React, not an HTTP client, not a database driver. Everything platform-specific is
handed to it at startup. That is what allows one implementation to serve both the
browser and a phone.

The practical consequence: a fix is a version bump, not a patch applied by hand in
every repository.

### The conventions became executable

Conventions that live in a document drift. Catalyst's are enforced two ways.

**Generated.** A set of AI skills produces code already shaped to the standard - feature
slices, components, design tokens.

**Rejected when violated.** Lint rules refuse code that breaks the layering. Database
access is confined to one layer; a hook that reaches for it fails the build with an
explanation.

### The web application became the first deliverable

Every project builds the web version first - including projects that will only ever
ship a mobile app.

This is not a preference about platforms. It is about where the feedback loop is
fastest. The application is designed, built, reviewed, and QA'd on the web, where a
change takes seconds to see. Only once it is approved does the interface get ported to
native.

The client sees a working application early, and native work starts from something
already correct rather than something still being decided.

## How a project runs

1. **Design hands over the project's Figma file.** Every project starts from its own -
   there is no shared design system across projects.
2. **Design tokens are generated from it.** Colour, typography, spacing, radius, and
   shadow become a single source both platforms read.
3. **The web application is built.** Feature slices and components are generated to the
   conventions, then filled in.
4. **QA runs on the web** - both functional testing and a check of each component
   against its Figma source.
5. **The interface is ported to native.** Only JSX and styling change.
6. **The mobile application ships.**

Everything beneath the component layer - data access, business rules, synchronisation,
design tokens - is written once. Only the interface exists twice.

## Where AI fits

Catalyst does not put AI in the applications you deliver. It ships no model, stores no
data for one, and makes no inference calls at runtime. An application built with
Catalyst behaves exactly as its code says.

The AI works at **development time**. It is a Claude Code plugin whose skills know the
framework's conventions, and it can:

- turn a project's Figma file into a normalised token set
- scaffold a complete feature slice from an API response or a field list
- build a web component that is token-compliant and ready to port
- check a finished component against its Figma source and report differences
- port an approved web component to its React Native equivalent

What it understands is **the conventions** - not the client's business, not the
backend's data model, and not whether a feature is worth building. It removes the
repetitive work of conforming to a standard. The judgement stays with the developer.

## What Catalyst is not

- **Not a component library.** Both interface packages ship empty. Components are a
  product decision; the framework supplies the styling contract, not the buttons.
- **Not a backend.** It expects Frappe, including the application that serves
  synchronisation.
- **Not AI in your product.** See above.
- **Not a general-purpose React framework.** It is opinionated towards offline-first
  applications on Frappe, and those opinions are the reason it saves time.

## Where it fits

Catalyst suits a project where all of the following hold:

- the backend is **Frappe**
- the application must keep working **without a connection**
- SQL and a **server-defined local schema** are acceptable - the backend sends the
  table definitions the device applies

It is a poor fit for an application that can assume connectivity. The synchronisation
machinery is then cost without return, and a conventional client against the same API
will be simpler.

A different backend is possible - the engine synchronises through an interface rather
than a specific API - but it means writing and maintaining a replacement for that
integration layer. Worth planning deliberately rather than discovering midway.

---

Next: [Architecture](./how-it-works/architecture.md) covers the three
layers and the rule that governs how they fit together.
