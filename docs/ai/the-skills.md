---
title: The skills
description: Every skill in the dev kit - what it generates, what it reviews, and how to invoke it.
---

The dev kit contains ten skills and one agent. They fall into three groups, and knowing
which group you are dealing with tells you what to expect from it.

| Group | Produces | Examples |
|---|---|---|
| **Generators** | Files | `feature-slice`, `web-component`, `web-to-native` |
| **The reviewer** | A report, never an edit | `design-qa` |
| **Discipline skills** | Nothing directly - they shape how other work is done | `react-renderer`, `typescript-teacher` |

## Generators

These write files. All of them **append rather than overwrite** - an existing file is
never replaced.

### `design-system-setup`

Turns the project's Figma into the token system both platforms read.

- Extracts tokens from Figma through the MCP
- Establishes `tokens/index.ts` as the single source of truth, with `tokens/rn-styles.ts` derived from it
- Wires Tailwind as a *consumer* of those tokens, never as a definition of them
- Audits token drift afterwards

Run this **once per project, early**. Every project starts from its own Figma; there is
no shared design system to inherit.

### `feature-slice` - `/feature-slice`

Scaffolds the data path for a feature, in the correct layering.

- **Whole slice:** `hooks → repo → data/local (SQL) + data/remote (HTTP)`, plus `usecases` and `outbox` for offline writes
- **One endpoint:** paste a curl command, a JSON response, or a field list, and it adds the type, endpoint, remote function, repo method, and hook

It keeps `getOfflineDb` out of hooks and repositories, so the lint boundary holds by
construction rather than by correction.

```
/feature-slice new slice invoices
/feature-slice <paste a curl command here>
```

### `web-component`

Builds a component in `packages/ui-web`, Figma-first.

- Pulls the Figma node, extracts design values, maps them to tokens
- Generates a folder: `Name.tsx` + `Name.types.ts` + `index.ts`
- Uses `cva` for variants, `cn()` for class merging, `lucide-react` for icons
- Covers default, disabled, and loading states
- Re-exports from the package barrel

Components it produces are **migration-ready by default** - `onPress` rather than
`onClick`, a `label` prop rather than bare children - so the native port later is
mechanical.

### `rn-component`

The native counterpart. RN primitives, every string inside `<Text>`, `StyleSheet.create`
with `rnTokens`, variants as keyed styles rather than `cva`, `ActivityIndicator` for
loading, and `accessibilityRole` / `Label` / `State` for accessibility.

Use it for native components written from scratch. For porting an existing web
component, use `web-to-native` instead.

### `web-to-native`

Ports an approved web component to its native twin.

- Props mirrored **verbatim**, re-expressed as explicit unions
- HTML elements mapped to RN primitives
- `cva` variants converted to keyed `StyleSheet`
- Tailwind classes mapped to `rnTokens`
- Events and ARIA converted - `onClick` → `onPress`, ARIA → `accessibility*`

**The rule it will not break:** `@app/core` is never modified. Only JSX and styling
change.

It has a pre-migration checklist, and will send you back if the web component is not
ready - not QA-approved, still using `onClick`, carrying hardcoded values, or using a
token with no `rnTokens` equivalent. That last one is a `design-system-setup` gap and is
fixed there, not worked around here.

### `zustand-slice` - `/zustand-slice`

Scaffolds a global client-state store in `packages/core/src/state`, with state, actions,
and selectors colocated, immutable updates, narrow selector hooks, and persistence
through injected storage so `@app/core` stays platform-agnostic.

**Not** for server state (use `feature-slice`), local component state, or offline domain
data.

## The reviewer

### `design-qa` - `/design-qa`

A read-only agent that verifies a built `ui-web` component against its Figma source.
Five checks, every time:

1. **Token compliance** - no raw hex, no arbitrary Tailwind values, no inline styles
2. **Pixel accuracy** - spacing, typography, radius, dimensions against the design
3. **Variant coverage** - every Figma variant exists in the code
4. **State coverage** - default, disabled, loading, and any others in the design
5. **Spacing and layout**

Two things to know:

- **It never edits.** Its toolset is read-only by design. It returns a pass/fail report with flagged issues and suggested fixes; applying them is your call.
- **It needs to know which Figma node to compare against.** It reads a `// figma: <url>` annotation at the top of the component. With no annotation and no URL passed as an argument, it flags "no Figma source recorded" and stops. It will not guess a node.

```
/design-qa Button
/design-qa all
```

## Discipline skills

These generate nothing on their own. They carry the framework's rules for a particular
area and shape how the generators and your own edits behave.

| Skill | Covers |
|---|---|
| `nextjs-nerd` | The App Router shell - routing, layouts, metadata, streaming, server components. Enforces that the shell renders `ui-web` components and never builds UI inline |
| `react-native-expert` | Navigation, safe areas, keyboard, Android back, list performance, native modules |
| `react-renderer` | Effect design, memoisation, error boundaries, Suspense, custom hooks |
| `typescript-teacher` | Where a type belongs, shared local + remote entity contracts, discriminated unions, type guards |

They defer to each other deliberately - `react-native-expert` hands component building
to `rn-component`, data to `feature-slice`, tokens to `design-system-setup`. You rarely
invoke them by name; they engage when the work is in their area.

## Setup

### `/init-dev-kit`

Installs the `CLAUDE.md` guardrail files at the repository root and in `apps/web`. Every
other skill assumes those exist. Run it once when a project starts.

It copies templates rather than overwriting; pass `--force` to replace existing files.

## How to invoke

| Skill | How |
|---|---|
| `feature-slice`, `zustand-slice`, `design-qa`, `init-dev-kit` | Slash command |
| `design-system-setup`, `web-component`, `rn-component`, `web-to-native` | Describe the task - "build a Button in ui-web", "port Button to native" |
| The four discipline skills | Automatically, when the work is in their area |

## What they will not do

- **Overwrite your files.** `feature-slice` and `zustand-slice` append only.
- **Edit during review.** `design-qa` flags; it does not fix.
- **Guess a Figma node.** No annotation, no argument, no comparison.
- **Touch `@app/core` during a port.** The migration is JSX and styling only.

---

Next: [Trust and verify](./trust-and-verify.md) - what to accept, what to check, and
where generated code tends to need attention.
