---
title: How the AI fits
description: What the AI layer is, what it understands, what it does not, and where it participates in a Catalyst project.
---

Catalyst is built with AI assistance as the default path, not as an optional
convenience. The conventions in this framework are numerous and mostly mechanical -
which layer a file belongs in, how props should be named, which token a colour maps to.
Remembering them is work. Generating them is not.

## It is not in your product

Worth stating before anything else, because "AI layer" invites the wrong reading.

Catalyst ships **no model, no inference calls, and no data collection** into the
applications you deliver. An application built with Catalyst behaves exactly as its code
says. Nothing on this page changes at runtime.

The AI works at **development time**, on your machine, while you build.

## What it is

A **Claude Code plugin** - `agentic-dev-kit` - containing skills that know this
framework's conventions. It is enabled per project:

```json title=".claude/settings.json"
{
  "extraKnownMarketplaces": {
    "agentic-dev-kit": {
      "source": { "source": "github", "repo": "k-t18/agentic-dev-kit" }
    }
  },
  "enabledPlugins": { "agentic-dev-kit@agentic-dev-kit": true }
}
```

Reactant ships with this already configured, so a project generated from the template
has it from the first commit.

One additional step installs the guardrails the skills depend on:

```
/init-dev-kit
```

This writes `CLAUDE.md` files at the repository root and in `apps/web` containing the
invariants - tokens-only, the core layering rule, the never-do list, the web-layering
boundary. The skills assume those files are present. Without them, generated code is
less reliably correct, because the rules it must respect are no longer in context.

## What it understands

| Understands | Because |
|---|---|
| The framework's conventions | Encoded in the skills - slice anatomy, layering, props naming, element mapping |
| Your repository's shape | The `CLAUDE.md` guardrails installed by `/init-dev-kit` |
| Your project's design system | Read from Figma through the Figma MCP |
| The difference between web and native targets | Separate skills for each, plus an explicit migration path |

## What it does not understand

| Does not know | Consequence |
|---|---|
| Your client's business domain | It can scaffold a slice; it cannot tell you the slice is modelling the wrong thing |
| Your backend's data model | It shapes code to a response you paste; it never inspects the server |
| Whether a feature is worth building | Product judgement stays entirely with you |
| Whether the design is good | `design-qa` checks *fidelity to Figma*, not whether the Figma is right |
| How the app behaves on a real device | It cannot run an emulator or a build |

The short version: **it knows how things should be built here. It does not know what
should be built.**

## Where it participates

A project runs through eight stages. AI is involved in five of them.

| Stage | Who | What |
|---|---|---|
| 1. Figma handover | Design | The project's own file - there is no shared design system |
| 2. **Design tokens** | **AI** | `design-system-setup` extracts and normalises tokens from that Figma |
| 3. **Feature slices** | **AI** | `feature-slice` scaffolds the data path from a pasted response |
| 4. **Components** | **AI** | `web-component` builds token-compliant, migration-ready components |
| 5. **Design QA** | **AI** | `design-qa` compares each component to its Figma source |
| 6. Functional QA | Human | Does the application actually do the right thing |
| 7. **Port to native** | **AI** | `web-to-native` converts JSX and styling; `@app/core` is untouched |
| 8. Release | Human | Signing, store submission, device verification |

Stages 6 and 8 are deliberately human. The AI can confirm a component matches its
design; it cannot confirm the feature is correct, and it cannot ship an app.

## The division of labour

A useful way to hold it:

- **The skill decides the shape.** Where files go, what they are called, which layer may
  import what, which token a value maps to.
- **You decide the substance.** What the feature does, whether the data model is right,
  whether the result is worth shipping.

This is why generated code still needs review - not because the AI is unreliable at
conventions, but because conventions were never the hard part.

---

Next: [The skills](./the-skills.md) - what each one does and how to invoke it.
