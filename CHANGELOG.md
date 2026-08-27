# Changelog

## v1.0.0

The first complete version of the Catalyst documentation site. Live at
<https://8848digital.github.io/catalyst-docs/>.

Seventeen pages covering the framework from the reason it exists through to a store
submission, organised around how people actually arrive rather than around a
conventional docs outline.

### Structure

```
Why Catalyst

How Catalyst works       Architecture · Offline sync · Data flow
AI-assisted development  How the AI fits · The skills · Trust and verify
Build                    Quickstart · The workspace · Design system setup
                         Your first feature · Writes and the outbox · Components and tokens
Ship to native           The migration · What web QA cannot catch · Release

Troubleshooting
```

There is no "Getting Started" section. It is a docs convention rather than a reader
need: a lead evaluating the framework and a developer starting a feature want different
first pages, so the landing page routes them instead.

### What is documented

**Why Catalyst exists.** The problem it was built for, stated as a delivery problem
rather than a feature list: every project rebuilding the same foundation, web and native
standards drifting apart, native iteration setting the pace, and knowledge concentrating
in individuals.

**How it works.** The three layers and the dependency rule, the two synchronisation
directions in full, and the complete round trip from a tap on a screen to the server and
back.

**AI-assisted development.** Catalyst ships no model and makes no inference calls at
runtime; the AI works at development time only. This section documents all ten skills and
the read-only design QA agent, and separates what to accept on sight from what always
needs checking.

**Building.** The daily work, written AI-first: each page leads with the command and then
explains what it produced, because the conventions are learned faster by reading a
correct example than by assembling one.

**Shipping to native.** The migration, what web QA structurally cannot catch, and the
release settings that must change before a store submission.

**Troubleshooting.** Written from error strings that already exist in the source, grouped
by where you hit them.

### Notable

- Every technical claim was verified against the source rather than inferred. Several
  pages document behaviour that is not discoverable from the code without tracing it,
  including the two SQLite drivers sharing no implementation, and the data endpoint
  signalling end-of-pages with what looks like an error.
- The site is public while the packages are private. Pages state this rather than letting
  a reader discover it at an authentication failure.
- Four URLs changed during the restructure. Redirects keep the originals working.
- `onBrokenLinks` is set to `throw`, so a dead internal link fails the deploy.

### Known gaps

- Generated API reference for `offline-kit` and `catalyst` is not built yet. Until it is,
  signatures live only in source.
- Nothing verifies that symbols named in prose still exist in the packages. One stale
  reference is currently published: the architecture page names
  `@8848digital/reactant`, which is not a published package.
- The `mobile_offline_sync` backend application is a documented prerequisite with nothing
  to link to.
