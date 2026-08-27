---
title: Components and tokens
description: The pipeline from a project's Figma to a token set, a web component, and its native twin - and what to check at each step.
---

Both component packages - `@app/ui-web` and `@app/ui-native` - ship empty. That is
deliberate: components are product decisions, and the template does not presume a design
system.

What the framework provides is the **styling contract** both packages read from, and a
pipeline that produces components conforming to it.

## The pipeline

| Step | Skill | Produces | Run |
|---|---|---|---|
| 1. Tokens | `design-system-setup` | `tokens/index.ts` + `tokens/rn-styles.ts` | Once per project |
| 2. Web component | `web-component` | A component folder in `ui-web` | Per component |
| 3. Verify | `design-qa` | A pass/fail report, never an edit | Per component |
| 4. Native twin | `web-to-native` | The `ui-native` equivalent | After web QA passes |

The rest of this page is what each step produces and what to check, because reviewing
generated output is the actual skill.

## Where component code lives

Three homes, and choosing correctly matters more than it first appears.

| Location | What belongs there | Runs on |
|---|---|---|
| `apps/web/app/**` | Routing, layout, metadata, data loading. Server Components by default. | Web only - never migrates |
| `packages/ui-web` | Presentational and interactive components. Pure React plus Tailwind. | Web, and portable in principle |
| `packages/ui-native` | The React Native equivalents. | Native |

The distinction between the first two is the one people get wrong. The Next.js `app`
directory is the **server shell** - it owns the route, the page title, and what data gets
fetched. It has no native counterpart and never will. Anything with a native twin, or
that could plausibly grow one, belongs in `@app/ui-web`.

A practical test: if the component would break without a server, it is not a `ui-web`
component.

## Step 1 - Generate the token set

Every project starts from **its own Figma file**. There is no shared design system to
inherit, so this runs once, early, per project.

The `design-system-setup` skill extracts the values through the Figma MCP and
establishes the two-file pipeline:

```
packages/core/src/tokens/index.ts       the single source of truth
packages/core/src/tokens/rn-styles.ts   derived from it, for React Native
```

It also wires Tailwind as a **consumer** of those tokens. Tailwind never defines a value;
it reads them. If you find yourself editing `tailwind.config.ts` to change a colour,
something has gone wrong.

### What the token set contains

| Group | Keys |
|---|---|
| `typography.size` | `xs` 12 · `sm` 14 · `md` 16 · `lg` 18 · `xl` 24 · `2xl` 32 |
| `typography.weight` | `regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 |
| `spacing` | `0` · `1` 4 · `2` 8 · `3` 12 · `4` 16 · `5` 20 · `6` 24 · `8` 32 · `10` 40 · `12` 48 · `16` 64 |
| `radius` | `none` 0 · `sm` 4 · `md` 8 · `lg` 12 · `xl` 16 · `full` 9999 |
| `shadow` | `sm` · `md` · `lg`, each with separate `web` and `native` forms |

Colours are grouped by **role** rather than hue - `text.*`, `surface.*`, `border.*`,
`semantic.*`, `input.*`, `overlay.*`, plus `brand.*` and the raw `palette.*` ramps. Reach
for the role, not the ramp: `colors.text.secondary`, not `palette.neutral[600]`.

## How tokens reach a web component

The mapping is mechanical but not always obvious, and it is what you are reading when
you review a generated component:

| Token | Class |
|---|---|
| `colors.text.primary` | `text-text-primary` |
| `colors.surface.canvas` | `bg-surface-canvas` |
| `colors.border.default` | `border-border-default` |
| `typography.size.md` | `text-md` |
| `spacing[4]` | `p-4`, `gap-4`, `mt-4` … |
| `radius.md` | `rounded-md` |
| `shadow.sm` | `shadow-sm` |

The doubled names - `text-text-primary`, `border-border-default` - look wrong and are
correct. The first word is the Tailwind utility, the second is the token group.

:::warning[Three Tailwind gotchas]

**Use `text-md`, not `text-base`.** The token scale names the 16px step `md`, where
Tailwind's default calls it `base`. Both classes exist; only `text-md` is a token.

**Radius values differ from Tailwind's defaults.** The tokens override `sm`, `md`, `lg`,
and `xl` with 4/8/12/16px rather than Tailwind's 2/6/8/12px. Same names, different values.

**Non-token utilities still resolve.** The config uses `theme.extend`, so Tailwind's own
scale remains available - `p-7` and `rounded-2xl` render fine while silently bypassing the
token system. If a value is not in the tables above, it is not a token.

:::

One more thing the config controls: which files Tailwind scans.

```ts title="apps/web/tailwind.config.ts"
content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
```

`@app/ui-web` is listed explicitly. A new package containing Tailwind classes must be
added here too - otherwise its classes are purged from the production build, and the
component renders unstyled only after deploying.

## Before generating a web component

`@app/ui-web` does not declare `@app/core`. Every other package in the workspace does, so
a component there cannot import a product hook until you add it:

```json title="packages/ui-web/package.json"
"dependencies": {
  "@app/core": "workspace:*",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.469.0",
  "tailwind-merge": "^2.5.2"
}
```

Then `pnpm install`. `@app/ui-native` already declares it.

## Step 2 - Generate the component

The `web-component` skill is **Figma-first**. Give it the node; it extracts the design
values, maps them to tokens, and produces a folder:

```
packages/ui-web/src/components/StatusBadge/
  StatusBadge.tsx
  StatusBadge.types.ts
  index.ts
```

What it generates, and why each convention exists:

- **`cva` for variants**, so variant logic is declarative and can be mechanically converted to keyed `StyleSheet` during the native port.
- **`cn()` for class merging** - `clsx` composed with `tailwind-merge`. This is what lets a caller's `className="px-6"` actually override a built-in `px-3` instead of producing two competing padding classes.
- **A props interface in its own `.types.ts`**, extending `VariantProps`, so the native twin can mirror it verbatim.
- **Default, disabled, and loading states** covered.
- **A `// figma:` annotation** at the top recording the source node. `design-qa` reads it; without it, verification cannot run.
- **Migration-ready naming** - `onPress` rather than `onClick`, a `label` prop rather than bare children, `className` optional.

That last one is worth understanding rather than just accepting. Native has no
`onClick` and its `Text` needs a string rather than JSX children. Naming props this way
on the web costs nothing and makes the later port mechanical instead of a redesign.

A component with no Figma node is the case where this skill does not apply - there is
nothing to extract. Write those by hand, following the same conventions.

## Step 3 - Verify against the design

```
/design-qa StatusBadge
```

Five checks run every time: token compliance, pixel accuracy, variant coverage, state
coverage, and spacing.

Two things to know:

- **It never edits.** Its toolset is read-only by design. You get a report with flagged issues and suggested fixes; applying them is your call.
- **It will not guess a Figma node.** No `// figma:` annotation and no URL argument means it flags "no Figma source recorded" and stops.

What it proves is *fidelity to the design*. It cannot tell you the design is wrong.

## The native side

Native has no class names. Styles come from `rnTokens`, a StyleSheet-ready projection of
the same token file:

```tsx title="packages/ui-native/src/components/StatusBadge/StatusBadge.tsx"
import { StyleSheet, Text, View } from 'react-native';
import { rnTokens } from '@app/core/tokens/rn-styles';

export function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <View style={styles.base}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: rnTokens.spacing[3],
    paddingVertical: rnTokens.spacing[1],
    borderRadius: rnTokens.radius.full,
    backgroundColor: rnTokens.colors.neutral[100],
  },
  label: {
    fontSize: rnTokens.typography.size.sm,
    fontWeight: rnTokens.typography.weight.medium,
    color: rnTokens.colors.textSecondary,
  },
});
```

`apps/native/src/screens/WelcomeScreen.tsx` is a working example in the template.

:::warning[The native token surface is narrower than the web one]

`rnTokens` exposes a **subset**. Present on web but absent from `rnTokens` today:

- the `palette.primary` ramp (only `colors.primary` is exposed)
- `semantic.warning`, `semantic.info`, and every `*Surface` variant
- `text.placeholder`, `text.disabled`
- `surface.muted`, `surface.page`
- `border.strong`, all of `input.*`, and `overlay.*`
- `shadow.topBar`, which has no native form at all

`web-to-native` checks this before it starts: if the web component uses a token with no
`rnTokens` equivalent, it stops and sends you back. That is a `design-system-setup` gap,
and the fix is to widen `tokens/rn-styles.ts` - not to hardcode a value in the component.

:::

## Step 4 - Port to native

```
port StatusBadge from ui-web to ui-native
```

`web-to-native` mirrors the props verbatim as explicit unions, maps HTML elements to RN
primitives, converts `cva` variants to keyed `StyleSheet`, translates Tailwind classes to
`rnTokens`, and swaps events and ARIA for `onPress` and `accessibility*`.

**The rule it will not break:** `@app/core` is never modified. Only JSX and styling
change.

Its pre-migration checklist will refuse a component that is not QA-approved, still uses
`onClick`, carries hardcoded values, or needs a missing `rnTokens` entry. Those are all
signals to fix the web component first.

## What to check in the port

The conversion is mechanical, so the output is reliable. What is not verifiable by any
skill is how it behaves on a device:

- every bare string wrapped in `<Text>` - native throws otherwise
- `FlatList` for dynamic lists, not `.map`
- no percentage widths, no CSS shorthand
- and then: run it on a device

## Rebranding

1. Edit the values in `packages/core/src/tokens/index.ts`. **Keep every key** - both
   consumers index into these names.
2. Restart the web dev server. Tailwind reads its config at build time, so a token change
   is not picked up by hot reload.
3. Native needs no step. `rnTokens` derives from the same file.

Because components reference roles rather than values, a rebrand needs no component
edits. If one does, a raw value leaked in somewhere - and `design-qa` will find it.

## Icons

`lucide-react` on web, `react-native-vector-icons` on native. Both are installed; neither
is wired into anything. They are available, not prescribed.

---

Related: [Your first feature](./your-first-feature.md) renders a `ui-web` component from
a route, and [The skills](../ai/the-skills.md) covers the rest of the dev kit.
