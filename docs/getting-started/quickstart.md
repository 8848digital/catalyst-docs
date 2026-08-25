---
title: Quickstart
description: Create a project from the reactant template, personalise it, and get the web application running locally in about ten minutes.
---

This guide takes a new project from an empty directory to a running web application.
It requires no backend — the initial screen renders without a server, so the
environment can be verified before any API is available.

Expect this to take about ten minutes, most of which is dependency installation.

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node 20 or later** | Verify with `node -v`. |
| **pnpm 11 or later** | The workspace pins its package manager. Verify with `pnpm -v`. |
| **A registry read token** | The engine and chassis are published privately. See step 1. |
| **GitHub CLI** *(recommended)* | Creates the project from the template in a single command. See step 2. |

A React Native toolchain is required only for the mobile application, which is
covered at the end of this guide.

## 1. Configure registry access

The engine and chassis are published to GitHub Packages under the `@8848digital`
scope. Installation fails without a token, so this must be done before installing
dependencies.

Create a GitHub personal access token with the **`read:packages`** scope, then add it
to your **user-level** `~/.npmrc`:

```ini title="~/.npmrc"
@8848digital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_READ_TOKEN
```

The template repository already contains an `.npmrc` that routes the `@8848digital`
scope to the correct registry. Only the token belongs in your user-level file — never
commit it to a project.

## 2. Create your project repository

Reactant is a GitHub **template repository**, not a dependency. Generating from it
produces a new repository containing the template's files under a single initial
commit, with no fork relationship and no shared history. Your project is independent
from the outset, and will not receive upstream updates.

The GitHub CLI does this in one command:

```bash
gh repo create 8848digital/my-project --template 8848digital/reactant --private --clone
cd my-project
```

- Omit the `8848digital/` prefix to create the repository under your own account.
- `--clone` checks the new repository out locally, already pointing at its own remote.
- Only the template's default branch is copied. Pass `--include-all-branches` if you
  specifically need the others.

This requires the GitHub CLI, authenticated as an account with access to the private
template. Verify with `gh auth status`.

### Without the GitHub CLI

Clone the template, discard its history, and initialise your own:

```bash
git clone https://github.com/8848digital/reactant.git my-project
cd my-project
rm -rf .git && git init
```

Then create an empty repository on GitHub and add it as the remote. This is also the
faster route when you only want to evaluate the template and do not intend to keep it.

## 3. Personalise the project

```bash
node setup.mjs
```

The script prompts for two values:

| Prompt | Default | Used for |
|---|---|---|
| **Project name** | `Reactant` | Package names and the web page title. |
| **API Base URL** | `http://localhost:8000` | Written into the environment files for both applications. |

It then writes:

- the workspace package names, derived as a slug from the project name — `my-project`, `my-project-web`, `my-project-native`
- the browser page title, in the web application's root layout
- `apps/web/.env` with `NEXT_PUBLIC_API_BASE_URL`
- `apps/native/.env` with `API_BASE_URL`

The script **deletes itself once it completes**. It is a one-time operation, and it
runs before dependencies are installed because it depends on nothing beyond Node.

It deliberately does not set the mobile application's bundle identifier. That is a
release-time task, documented separately.

## 4. Install dependencies

```bash
pnpm install
```

This resolves the private packages using the token configured in step 1.

## 5. Start the web application

```bash
pnpm --filter web dev
```

Open **http://localhost:3000**.

A welcome screen confirms the installation. The engine and chassis are initialised
and idle: no outbox adapters are registered yet, so the startup sequence never opens
the local database and never contacts a server. Nothing beyond a browser is required
to reach this point.

## What the startup sequence did

Before the first screen rendered, the application supplied every platform-specific
implementation the lower layers require — the database driver, the connectivity
source, the synchronisation transport, the API base URL, and the authentication token
accessor.

That wiring lives in one file per platform:

- Web — `apps/web/app/providers.tsx`
- Mobile — `apps/native/src/bootstrap.ts`

Both register the same set of implementations. Only the concrete values differ.

## Running the mobile application

This step requires a configured React Native toolchain — Android Studio for Android,
Xcode for iOS. Substitute your own project slug:

```bash
pnpm --filter my-project-native start     # Metro bundler
pnpm --filter my-project-native android   # or: ios
```

## Troubleshooting

**`E401` or `Unauthorized` while installing.** The token is missing, expired, or
lacks the `read:packages` scope. Confirm it is present in `~/.npmrc` and that your
account has access to the `8848digital` organisation's packages.

**`npm install` fails with `Cannot read properties of null`.** This workspace is
pnpm-only. npm cannot resolve pnpm's dependency layout. Use `pnpm install`.

**Port 3000 is already in use.** Pass an alternative port:
`pnpm --filter web dev -- --port 3001`.

**Blank page or a database error once offline features are added.** Local storage on
the web requires cross-origin isolation. The template's Next.js configuration already
sends the required headers in development, and any production server must send them
as well. Browser shields and privacy extensions can block cross-origin isolation even
when the headers are correct.

---

Next: [What am I looking at?](./what-am-i-looking-at.md) — a tour of the workspace you
just generated, and where each kind of change belongs.
