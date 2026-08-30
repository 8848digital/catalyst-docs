---
title: Trust and verify
description: What generated code can be accepted on sight, what needs checking, and the limits of what the AI can confirm.
---

Generated code is not automatically correct, and reviewing it line by line defeats the
purpose. The useful question is narrower: **which parts are mechanical, and which parts
required a judgement the AI could not make?**

Mechanical output is reliable. Judgement is where to look.

## Trust

These are conventions with one right answer. The skill knows it, and checking by hand
adds nothing.

| Accept on sight                                         | Why                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| File placement and naming                               | Fully determined by the slice and component conventions           |
| Layering - which file imports what                      | Determined by the rules, and the linter catches violations anyway |
| Boilerplate: barrels, index files, re-exports           | Mechanical                                                        |
| Props naming - `onPress`, `label`, `className` optional | A fixed convention, applied consistently                          |
| Token usage instead of raw values                       | `design-qa` verifies this independently                           |
| Element mapping during a native port                    | A lookup table: `div` → `View`, `span` → `Text`                   |
| `cva` variants becoming keyed `StyleSheet`              | A mechanical transform                                            |

## Verify

These required an interpretation, an assumption, or knowledge the AI does not have.

| Check every time                  | What goes wrong                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The data model**                | A slice scaffolded from a pasted response mirrors _that_ response. If the sample was partial or unrepresentative, the types are wrong in a way that compiles |
| **Business rules in `usecases`**  | The skill generates the shape of a write path, not the rules governing it                                                                                    |
| **Anything touching sync**        | Outbox adapters, retry behaviour, what counts as a permanent failure. Errors here surface as lost or duplicated records, not as build failures               |
| **SQL correctness**               | Generated queries are syntactically valid and may still be semantically wrong - a missing filter, a wrong join, an index that does not exist                 |
| **Native behaviour after a port** | The port is mechanical; the _result_ has never run on a device                                                                                               |
| **Whether the design is right**   | `design-qa` proves the component matches the Figma. It cannot tell you the Figma is wrong                                                                    |

## Hard limits

Four things the AI cannot do, regardless of how the prompt is written:

- **It cannot run your application.** No emulator, no device, no dev server.
- **It cannot reach your backend.** It shapes code to a response you paste. It never calls the server to confirm the shape is real or current.
- **It cannot edit during review.** `design-qa` is read-only by construction; it reports and stops.
- **It cannot judge product decisions.** Whether a feature is worth building, whether a flow makes sense, whether the client will accept it.

## A review pass that is worth doing

Roughly two minutes per generated slice or component:

1. **Do the types match reality?** Compare generated types against the actual API response, not the sample that was pasted.
2. **Does the SQL do what it should?** Read the `WHERE` clause and the ordering.
3. **Is anything hardcoded?** `design-qa` catches this on components; nothing catches it in a data layer.
4. **Run `pnpm lint`.** The layering rules are enforced, so a violation reports itself with an explanation.
5. **Run it.** The single highest-value check, and the one the AI cannot perform.

## Where trust breaks down over time

Two failure modes worth naming, because neither shows up in a build.

**The skills encode conventions that may have moved on.** If a convention changes in the
framework but not in the kit, generated code is confidently wrong. It compiles, it lints,
and it does not match how the team now works. This has happened before: when the API
client and query hooks moved out of the product repository into an installed package, the
skills kept generating the old relative imports until someone noticed.

**Reviewing less over time.** Generated output is usually right, which trains you to stop
looking. The parts that need judgement are precisely the parts that stay wrong quietly -
a filter that excludes the wrong rows, an outbox adapter that marks a record synced too
early. Those do not announce themselves.

The discipline that keeps this working is narrow: **accept the conventions, read the
logic, and run the result.**

---

Related: [How the AI fits](./how-it-fits.md) explains what the AI understands, and
[The skills](./the-skills.md) covers what each one produces.
