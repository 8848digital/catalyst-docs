---
title: Components and tokens
description: Where component code lives, how the design tokens reach Tailwind and React Native, and how to build a component that works on both platforms.
---

Both component packages - `@app/ui-web` and `@app/ui-native` - ship empty. That is
deliberate: components are product decisions, and the template does not presume a
design system. What it does provide is the styling contract both packages read from.

## Where component code lives

There are three homes, and choosing correctly matters more than it first appears.

| Location | What belongs there | Runs on |
|---|---|---|
| `apps/web/app/**` | Routing, layout, metadata, data loading. Server Components by default. | Web only - never migrates |
| `packages/ui-web` | Presentational and interactive components. Pure React plus Tailwind. | Web, and portable in principle |
| `packages/ui-native` | The React Native equivalents. | Native |

The distinction between the first two is the one people get wrong. The Next.js `app`
directory is the **server shell** - it owns the route, the page title, and what data
gets fetched. It has no native counterpart and never will. Anything with a native twin,
or that could plausibly grow one, belongs in `@app/ui-web` instead.

A practical test: if the component would break without a server, it is not a `ui-web`
component.

## One source for every visual value

All colour, typography, spacing, radius, and shadow values live in a single file:

```
packages/core/src/tokens/index.ts
```

Nothing else defines them. Tailwind does not define colours; it reads them. React
Native styles do not define spacing; they read it. Rebranding is therefore editing one
file rather than auditing a codebase.

The values shipped in the template are **neutral placeholders**. Replace them, but keep
the shape - both consumers below index into these exact keys.

### The scales

| Group | Keys |
|---|---|
| `typography.size` | `xs` 12 · `sm` 14 · `md` 16 · `lg` 18 · `xl` 24 · `2xl` 32 |
| `typography.weight` | `regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 |
| `spacing` | `0` · `1` 4 · `2` 8 · `3` 12 · `4` 16 · `5` 20 · `6` 24 · `8` 32 · `10` 40 · `12` 48 · `16` 64 |
| `radius` | `none` 0 · `sm` 4 · `md` 8 · `lg` 12 · `xl` 16 · `full` 9999 |
| `shadow` | `sm` · `md` · `lg`, each with separate `web` and `native` forms |

Colours are grouped by role rather than by hue - `text.*`, `surface.*`, `border.*`,
`semantic.*`, `input.*`, `overlay.*`, plus `brand.*` and the raw `palette.*` ramps.
Reach for the role, not the ramp: `colors.text.secondary`, not `palette.neutral[600]`.

## Web: tokens reach you as Tailwind classes

`apps/web/tailwind.config.ts` imports the token file and maps it into the theme. It
defines no values of its own. The class names that result are mechanical but not always
obvious:

| Token | Class |
|---|---|
| `colors.text.primary` | `text-text-primary` |
| `colors.surface.canvas` | `bg-surface-canvas` |
| `colors.border.default` | `border-border-default` |
| `typography.size.md` | `text-md` |
| `spacing[4]` | `p-4`, `gap-4`, `mt-4` … |
| `radius.md` | `rounded-md` |
| `shadow.sm` | `shadow-sm` |

The doubled names (`text-text-primary`, `border-border-default`) look wrong and are
correct - the first word is the Tailwind utility, the second is the token group.

:::warning[Three Tailwind gotchas]

**Use `text-md`, not `text-base`.** The token scale names the 16px step `md`, where
Tailwind's default calls it `base`. Both classes exist; only `text-md` is a token.

**Radius values differ from Tailwind's defaults.** The tokens override `sm`, `md`,
`lg`, and `xl` with 4/8/12/16px rather than Tailwind's 2/6/8/12px. Same names,
different values.

**Non-token utilities still resolve.** The config uses `theme.extend`, so Tailwind's
own scale remains available - `p-7` and `rounded-2xl` will render, silently bypassing
the token system. If a value is not in the tables above, it is not a token.

:::

One more thing the config controls: which files Tailwind scans.

```ts title="apps/web/tailwind.config.ts"
content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui-web/src/**/*.{ts,tsx}'],
```

`@app/ui-web` is listed explicitly. If you add another package containing Tailwind
classes, add its path here too - otherwise its classes are purged from the production
build and the component renders unstyled only after deploying.

## Before writing a web component

`@app/ui-web` does not declare `@app/core` as a dependency. Every other package in the
workspace does; this one is the exception. A component there cannot import a product
hook until you add it:

```json title="packages/ui-web/package.json"
"dependencies": {
  "@app/core": "workspace:*",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^0.469.0",
  "tailwind-merge": "^2.5.2"
}
```

Then re-run `pnpm install`. `@app/ui-native` already declares it, so the native side
needs no equivalent step.

## Building a web component

```tsx title="packages/ui-web/src/components/StatusBadge.tsx"
'use client';

import { cn } from '../lib/utils';

interface StatusBadgeProps {
  label: string;
  tone?: 'neutral' | 'success' | 'error';
  className?: string;
}

export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        tone === 'neutral' && 'bg-surface-muted text-text-secondary',
        tone === 'success' && 'bg-success-surface text-success',
        tone === 'error' && 'bg-error-surface text-error',
        className,
      )}
    >
      {label}
    </span>
  );
}
```

Export it from the barrel:

```ts title="packages/ui-web/src/index.ts"
export { StatusBadge } from './components/StatusBadge';
```

Two conventions in that example.

**`cn` handles conditional and conflicting classes.** It is `clsx` composed with
`tailwind-merge` (`packages/ui-web/src/lib/utils.ts`). `clsx` resolves the conditionals;
`tailwind-merge` ensures a caller passing `className="px-6"` actually overrides the
built-in `px-3` rather than producing two competing padding classes. Accepting a
`className` prop and merging it last is what makes a component reusable.

**Every value is a token.** No hex codes, no arbitrary values like `text-[15px]`.

For components with several dimensions of variation, `class-variance-authority` is
already installed and gives a typed variant API instead of a growing pile of ternaries.
It is worth reaching for at about three variants.

## Building a native component

Native has no class names. Styles come from `rnTokens`, a StyleSheet-ready projection
of the same token file:

```tsx title="packages/ui-native/src/components/StatusBadge.tsx"
import { StyleSheet, Text, View } from 'react-native';
import { rnTokens } from '@app/core/tokens/rn-styles';

interface StatusBadgeProps {
  label: string;
  tone?: 'neutral' | 'success' | 'error';
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <View style={[styles.base, styles[tone]]}>
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
  },
  neutral: { backgroundColor: rnTokens.colors.neutral[100] },
  success: { backgroundColor: rnTokens.colors.neutral[100] },
  error: { backgroundColor: rnTokens.colors.neutral[100] },
  label: {
    fontSize: rnTokens.typography.size.sm,
    fontWeight: rnTokens.typography.weight.medium,
    color: rnTokens.colors.textSecondary,
  },
});
```

`rnTokens` is derived from the same token file, so a brand change propagates without
touching this file. `apps/native/src/screens/WelcomeScreen.tsx` is a working example in
the template.

:::warning[The native token surface is narrower than the web one]

`rnTokens` exposes a **subset**. Present on web but absent from `rnTokens` today:

- the `palette.primary` ramp (only `colors.primary` is exposed)
- `semantic.warning`, `semantic.info`, and every `*Surface` variant
- `text.placeholder`, `text.disabled`
- `surface.muted`, `surface.page`
- `border.strong`, all of `input.*`, and `overlay.*`
- `shadow.topBar`, which has no native form at all

This is why the success and error tones above fall back to a neutral background - the
surface colours they need are not projected yet.

If a native component needs one of these, add it to `packages/core/src/tokens/rn-styles.ts`
rather than reaching into the raw token file or hardcoding a value. That file is the
seam; widening it is the intended change.

:::

## Keeping a component migratable

A `ui-web` component that may one day get a native twin should hold to four rules:

1. **`'use client'` at the top.** It uses hooks or handlers, so it cannot be a Server Component.
2. **No server-only APIs.** Nothing from `next/headers`, no filesystem access, no environment reads. It must run without a server.
3. **Data by props or `@app/core` hooks.** Never a direct SQL call, and never a fetch of its own.
4. **No framework-specific imports.** `next/link` and `next/image` have no native equivalent. Take an `onPress`-style callback or a plain href as a prop instead.

Components that follow these have a mechanical native port: the logic and props transfer
unchanged, and only the markup and styling are rewritten.

## Rebranding

1. Edit the values in `packages/core/src/tokens/index.ts`. **Keep every key** - both
   consumers index into these names.
2. Restart the web dev server. Tailwind reads the config at build time, so a token
   change is not picked up by hot reload.
3. Native requires no step. `rnTokens` derives from the same file.

Since components reference roles rather than values, a rebrand needs no component edits.
If one does, a raw value leaked in somewhere.

## Icons

Both packages ship an icon library: `lucide-react` on web, `react-native-vector-icons`
on native. Neither is wired into anything yet - they are available, not prescribed.

---

Related: [Your first feature](./your-first-feature.md)
renders a `ui-web` component from a Next.js route, and
[The workspace](./the-workspace.md) covers where each
kind of change belongs.
