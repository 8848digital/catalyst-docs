---
title: Design system setup
description: Turning a project's Figma file into the token set both platforms read, and keeping it in step as the design changes.
---

This is the first thing you do on a new project, before any component exists.

Every project starts from **its own Figma file**. There is no shared design system to
inherit across projects, so this runs once per project rather than once per company.

## The architecture it establishes

```
Figma  (the project's file)
  │  extracted via MCP
  ▼
packages/core/src/tokens/index.ts        the single source of truth
  │
  ├──▶ packages/core/src/tokens/rn-styles.ts    derived, for React Native
  │
  └──▶ apps/web/tailwind.config.ts              a consumer, never a definer
```

The critical relationship is the last one. `tailwind.config.ts` imports the token file
and maps it into the theme. It defines nothing of its own. If you ever find yourself
editing a colour in the Tailwind config, the system has been bypassed.

## Running it

Describe the task and point it at the Figma file. The skill works through eight phases:

| Phase | What happens |
|---|---|
| 1. Audit | Inspects the repo first - monorepo shape, whether Tailwind is a consumer, Metro's `watchFolders`, any existing token drift |
| 2. Extract | Pulls foundation, semantic, and component tokens from Figma, plus interaction states and theme modes |
| 3. Normalise | Maps Figma's naming into the three-layer model and tags each token with a confidence level |
| 4. Platform-split | Separates values that differ by platform - shadows become `{ web, native }` |
| 5. Summarise | Reports what it found, with confidence and gaps, and confirms before writing |
| 6. Generate | Writes `index.ts`, then `rn-styles.ts`, then the Tailwind config, then fonts and barrels |
| 7. Accessibility | Checks WCAG AA contrast and that states remain distinguishable |
| 8. Summary | Files written, token counts, drift, next steps |

Phase 5 is the one to read properly. It tells you which tokens it was confident about and
which it guessed, and that is where a bad extraction is cheapest to catch.

## The three layers

Tokens are normalised into a hierarchy rather than a flat list:

- **Foundation** - raw values. The indigo ramp, the neutral ramp, the type scale.
- **Semantic** - roles that reference foundation values. `text.secondary`, `surface.canvas`, `border.default`.
- **Component** - only when the design explicitly defines them.

Components should reference the **semantic** layer. `colors.text.secondary` survives a
rebrand; `palette.neutral[600]` does not, because a rebrand changes which ramp step that
role points at.

## What gets split by platform

Two things cannot be shared as-is.

**Shadows.** Web takes a CSS string; native needs `shadowColor`, `shadowOffset`,
`shadowOpacity`, `shadowRadius`, and Android's `elevation`. The token holds both forms
and each consumer takes the one it needs.

**Fonts.** Family names resolve differently on each platform, and native additionally
needs the font files registered in the native projects.

The skill also refuses two things in `rn-styles.ts` that are perfectly normal on the web:
**percentage widths** and **CSS shorthand**. React Native's `StyleSheet` rejects both.

## When the Figma changes

Re-run the skill. It audits for drift first and reports what has diverged rather than
overwriting blindly.

Two rules keep re-runs safe:

- **Keep every key.** Both consumers index into these names, so removing one breaks compilation somewhere.
- **Restart the web dev server.** Tailwind reads its config at build time, so a token change is not picked up by hot reload. Native needs no equivalent step, because `rnTokens` derives from the same file at runtime.

## Pitfalls worth knowing

| Do not | Why |
|---|---|
| Define values in `tailwind.config.ts` | It consumes tokens; it never defines them |
| Generate only web tokens | `rn-styles.ts` must be produced in the same pass, or native silently falls behind |
| Use a `.web` shadow on native | `StyleSheet` will not accept it |
| Promote a one-off mockup value into a global token | Accidental values become permanent that way |
| Invent dark-mode tokens Figma does not define | Mark them pending instead of guessing |
| Remove `watchFolders` from `metro.config.js` | Metro stops seeing `packages/core` and breaks without a useful error |

## Checking the result

1. **Does `rn-styles.ts` cover what the web tokens cover?** A gap here blocks a native port later, and `web-to-native` will stop rather than work around it.
2. **Do semantic names describe roles, not appearance?** `text.secondary`, not `text.grey`.
3. **Does contrast pass?** Phase 7 checks it, but confirm on the combinations your design actually uses.
4. **Does the web build still style correctly?** A missing entry in Tailwind's `content` array purges classes only in production.

---

Related: [Components and tokens](./components-and-tokens.md) for how these reach a
component, and [The skills](../ai/the-skills.md) for the rest of the dev kit.
