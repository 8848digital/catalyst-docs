---
title: What web QA cannot catch
description: The parts of a Catalyst application that only exist on a device, why web testing cannot reach them, and a checklist to run before the demo.
---

Building on the web first makes the feedback loop fast and catches most defects early.
It also means a specific set of problems is discovered **last** - after the port, close
to the demo, under time pressure.

None of these are reasons to change the approach. They are reasons to know exactly what
remains untested when web QA passes.

## The local database is a different implementation

This is the least obvious one, so it is worth stating plainly.

Both platforms satisfy the same `OfflineDb` contract, so `@app/core` cannot tell them
apart. Underneath, they share no code:

| | Web | Native |
|---|---|---|
| Engine | SQLite compiled to WebAssembly | `react-native-sqlite-2` |
| Storage | Origin Private File System | The device filesystem |
| Transactions | Worker messages, serialised by a JS mutex | A private low-level `exec`, with manual `BEGIN`/`COMMIT` |

The native driver exists in that shape for a specific reason: the library it wraps is a
WebSQL implementation whose transactions cannot stay open across an `await`, which is
exactly what the engine's `transaction(work)` relies on. So the driver bypasses the
WebSQL API and drives the primitive underneath it.

Two consequences worth carrying:

- **A bug in one driver is invisible in the other.** The value normalisation that
  converts a JavaScript boolean to `0`/`1` before it crosses the React Native bridge has
  no web equivalent, because the web driver never had that problem.
- **The native driver depends on a private field**, so `react-native-sqlite-2` is pinned
  to an exact version with a load-bearing comment. Widening that to a caret range during
  a dependency bump can break it silently.

In practice the drivers are carefully paired - same transaction mutex, same foreign-key
pragma, same error wrapping. The point is not that the data layer is fragile. It is that
"the data layer works" is a claim web QA cannot make on native's behalf.

## Screens behave differently

The framework itself encodes a behavioural difference between the platforms.

On the web, navigating away from a route and back **remounts** the screen, so local data
is re-read automatically. On native, the stack navigator keeps screens mounted, so a
returned-to screen would show a stale snapshot. The native app therefore calls
`refreshLocalData()` on every navigation transition.

That difference is real, deliberate, and untestable on the web. A screen that shows stale
data after navigating back is a native-only defect by construction.

## Everything else that has no web equivalent

- **Hardware and gesture back**, deep links, and the navigator itself
- **Runtime permissions** - a denial is permanent until the user visits Settings
- **Keyboard behaviour** - covering the focused input is the default, not an edge case
- **Safe areas** - notch, status bar, home indicator
- **List virtualisation** - a `.map()` over 500 rows scrolls fine on the web and stutters on a phone
- **Release builds** - signing, store review, and behaviour that differs from debug

## The acceptance pass

Run this after the port and before the demo. Most of it is ten minutes of manual work.

**Sync and data**

1. Fresh install, first sync creates tables and loads data
2. Kill the app mid-sync, relaunch - resumes with no duplicates and no missing tables
3. Airplane mode, create a record - appears immediately, marked pending
4. Restore the connection - the record pushes and the pending count returns to zero
5. Force-quit with pending records, relaunch - they still push
6. Kill the app immediately after a push - no duplicate on the server

**Navigation**

7. Hardware and gesture back from every screen - no crash, no blank screen
8. Navigate away and back - data is current, not stale
9. Deep link or notification tap lands on the right screen, if used

**Permissions**

10. Deny location - the app degrades gracefully rather than crashing
11. Grant it later from Settings - the feature works without a reinstall
12. iOS usage strings present; Android permissions uncommented in the manifest

**Device reality**

13. A 500-row list scrolls smoothly
14. The keyboard does not cover the focused input
15. Safe areas are correct on a notched device
16. Largest OS font size on the smallest supported screen - no clipped text

**Release**

17. A **release** build runs, not just debug
18. Verified on a real device, not only an emulator
19. Both platforms, if shipping both

Items 2, 5, 6 and 8 are the ones worth automating first. They are the failures that lose
or duplicate a user's work, and they are tedious to reproduce by hand.

## Why item 12 is on the list

The template ships with iOS's location usage string filled in, but the Android location
permissions in `AndroidManifest.xml` are **commented out** by default.

That is the correct default - an app that does not use location should not request it -
but it means a project that adds a location feature will work on iOS and silently fail on
Android until those lines are uncommented. Web QA sees neither.

---

Next: [Release](./release.md) - app identity, signing, and what has to be set before a
store submission.
