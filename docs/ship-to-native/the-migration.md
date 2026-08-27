---
title: The migration
description: What transfers unchanged from web to native, what gets rewritten, and how to run and review the port.
---

Once the web application is approved, the interface is ported to React Native. Nothing
below the component layer moves, because nothing below it was ever web-specific.

## What actually transfers

It helps to be precise about this, because "we just migrate the UI layer" understates
the work and produces optimistic estimates.

| | Transfers |
|---|---|
| `@app/core` - hooks, repositories, data access, types, tokens | **Unchanged.** Not edited, not copied, not adapted |
| The props interface | **Mirrored verbatim**, re-expressed as explicit unions |
| Component logic - state, conditionals, event wiring | Carries over structurally |
| JSX markup | **Rewritten** against RN primitives |
| Styling | **Rewritten** as `StyleSheet` with `rnTokens` |

So the component's *contract* and *behaviour* transfer; its *rendering* is rewritten. The
saving is real and large, but it comes from the data layer being written once, not from
the component being copied.

## Before you start

`web-to-native` checks these and will send you back if any fail:

- The web component is **QA-approved** - `design-qa` has passed on it
- It uses `onPress`, not `onClick`, and a `label` prop rather than bare children for text
- It has **zero hardcoded values** - tokens only
- Every token it uses has an `rnTokens` equivalent

That last one is the most common blocker, and it is not fixed here. A missing
`rnTokens` entry is a `design-system-setup` gap - widen `packages/core/src/tokens/rn-styles.ts`
rather than hardcoding a value in the native component. See
[Components and tokens](../build/components-and-tokens.md) for what the native token
surface currently omits.

## Running the port

```
port StatusBadge from ui-web to ui-native
```

The skill produces `packages/ui-native/src/components/StatusBadge/` and adds the barrel
export. Its one inviolable rule: **`@app/core` is never modified.**

## What it changes

### Elements

| Web | Native |
|---|---|
| `div`, layout `span` | `View` |
| `p`, `h1`-`h6`, `label`, text `span` | `Text` |
| `button` | `TouchableOpacity` wrapping a `Text` |
| `input` | `TextInput` - `onChangeText`, not `onChange` |
| `textarea` | `TextInput multiline` |
| `img` | `Image` - explicit `width` and `height` required |
| Long or dynamic list | `FlatList` - never `.map()` inside a `ScrollView` |
| Short static list | `View` with mapped `View` children |
| `a` / `Link` | `TouchableOpacity` + `navigation.navigate` |
| `form` | `View` - React Native has no form element |
| `hr` | `View` with `height: 1` and a background colour |

:::warning[Every string must be inside a Text element]

A bare string in a `View` **crashes** React Native. It is not a style problem or a
warning - the app throws.

```tsx
<View>Hello</View>                      // crashes
<View><Text>Hello</Text></View>         // correct
```

Watch for interpolated values, conditionally rendered text, and `{' '}` spacers. Each has
to sit inside a `Text`.

:::

### Styling

Tailwind classes become `StyleSheet` properties reading from `rnTokens`:

```ts
// bg-surface-canvas    -> backgroundColor: rnTokens.colors.surfaceCanvas
// text-text-secondary  -> color: rnTokens.colors.textSecondary
// px-4                 -> paddingHorizontal: rnTokens.spacing[4]
// gap-2                -> gap: rnTokens.spacing[2]
// text-md              -> fontSize: rnTokens.typography.size.md
// font-medium          -> fontWeight: rnTokens.typography.weight.medium
// rounded-md           -> borderRadius: rnTokens.radius.md
// shadow-sm            -> ...rnTokens.shadow.sm
```

Two of those are worth noticing. `shadow-sm` is **spread**, because the native form
carries both the iOS `shadow*` properties and the Android `elevation`. And `truncate` has
no style equivalent - it becomes `numberOfLines={1}` with `ellipsizeMode="tail"`, which
are props on `Text` rather than styles.

### Variants

A `cva` config becomes a keyed `StyleSheet`, selected by the same variant name:

```tsx
<View style={[styles.base, styles[intent]]} />
```

This is why web components use `cva` in the first place. Variant logic expressed
declaratively converts mechanically; the same logic expressed as ternaries over class
strings does not.

### Events, navigation, accessibility

| Web | Native |
|---|---|
| `onClick` | `onPress` |
| `onChange` | `onChangeText` |
| React Router / `next/link` | React Navigation |
| ARIA attributes | `accessibilityRole`, `accessibilityLabel`, `accessibilityState` |
| `Loader2` spinner | `ActivityIndicator` |

Imports are classified rather than translated wholesale: everything from `@app/core`
stays exactly as it was, web-only imports (`cn`, `cva`, `lucide-react`) are removed, and
`react-native` primitives are added.

## Reviewing the port

The conversion is mechanical, so the output is reliable. Check the things a mechanical
conversion cannot get right:

1. **Every bare string wrapped in `Text`** - the crash case above
2. **`FlatList` for anything dynamic** - a `.map()` over a long list will stutter
3. **No percentage widths, no CSS shorthand** - both are silently wrong in RN
4. **Props match the web twin exactly** - a drifted interface defeats the point of sharing
5. **It runs on a device**

That last one is not a formality. The port has never executed - see
[What web QA cannot catch](./what-web-qa-cannot-catch.md).

## Where navigation goes

`web-to-native` converts a link into a `navigation.navigate` call, but it does not build
your navigator. Screens are registered in
`apps/native/src/navigation/RootNavigator.tsx`, which ships with a single screen and a
comment marking where an auth stack belongs.

Navigation is the largest piece of native work with no web equivalent, and it is not part
of a component port.

---

Next: [What web QA cannot catch](./what-web-qa-cannot-catch.md) - the defects that only
appear on a device.
