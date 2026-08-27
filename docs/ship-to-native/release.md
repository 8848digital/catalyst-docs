---
title: Release
description: The app identity, signing, and permission settings that must be changed before a Catalyst project can be submitted to a store.
---

The template ships with deliberately neutral placeholders. Every one of them has to be
replaced before a store submission, and none of them are set by `setup.mjs` - they are
one-time, ship-time decisions rather than project-creation ones.

## App identity

The bundle identifier is globally unique and permanently tied to store listing, push
notifications, and deep links. Changing it after release is not practical, so set it
before the first submission.

| What                   | Where                                                                        | Placeholder            |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| Android application ID | `apps/native/android/app/build.gradle` - `namespace` and `applicationId`     | `com.example.reactant` |
| iOS bundle identifier  | Xcode build setting `PRODUCT_BUNDLE_IDENTIFIER`                              | project default        |
| Display name           | `apps/native/app.json` (`name`, `displayName`) and iOS `CFBundleDisplayName` | `ReactantApp`          |

`setup.mjs` deliberately leaves these alone. It renames package names and writes
environment files, but touching the bundle identifier at template-init time would be
guessing at a decision that belongs to the client and the store account.

## Android signing

The `release` variant is **unsigned by default**, and it does not fall back to the debug
keystore.

That fallback is a common convenience and a genuine hazard: the debug key
(`debug.keystore`, password `android`) is public and identical in every React Native
project, so anything signed with it can be re-signed by anyone. The template refuses to
use it for a release build.

With no keystore configured, the build still succeeds but produces an **unsigned**
artifact, and Gradle emits a warning when a release task is requested:

```
WARNING: No release keystore configured (keystore.properties / REACTANT_UPLOAD_* env).
This release build is UNSIGNED and cannot be uploaded to the Play Store.
```

### Generate an upload keystore

Once per application. Keep the file out of version control - `*.keystore` is already
gitignored:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore release.keystore \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

### Provide the credentials

Locally, copy the example file and fill it in:

```bash
cp apps/native/android/keystore.properties.example apps/native/android/keystore.properties
```

| Key                              | What it is                                 |
| -------------------------------- | ------------------------------------------ |
| `REACTANT_UPLOAD_STORE_FILE`     | Path to the keystore, absolute recommended |
| `REACTANT_UPLOAD_KEY_ALIAS`      | The alias chosen when generating it        |
| `REACTANT_UPLOAD_STORE_PASSWORD` | Keystore password                          |
| `REACTANT_UPLOAD_KEY_PASSWORD`   | Key password, often the same               |

In CI, set the same four names as environment variables instead. The build reads
`keystore.properties` first and falls back to the environment, so the same configuration
works in both places.

Both `keystore.properties` and `*.keystore` are gitignored. Never commit either.

### Build

```bash
cd apps/native/android && ./gradlew bundleRelease
```

## Permissions

`AndroidManifest.xml` declares `INTERNET` only. The location permissions are present but
**commented out**:

```xml
<!-- <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" /> -->
<!-- <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" /> -->
```

That is the right default - an application that does not use location should not ask for
it, and store reviewers treat unexplained permissions as a problem.

If your project uses the geolocation seam, uncomment the ones you need. iOS already
carries `NSLocationWhenInUseUsageDescription` with placeholder wording; replace it with a
sentence describing what your application actually does with the location. Vague or
boilerplate usage strings are a common rejection reason.

Every permission you add needs both halves: the Android manifest entry and the iOS usage
description.

## Before submitting

- Bundle identifier and display name set on both platforms
- Release keystore generated, stored safely, and **backed up** - losing it means you cannot ship an update to the same listing
- A signed release build produced and installed on a real device
- Permissions match what the application actually uses, with accurate usage strings
- The [acceptance pass](./what-web-qa-cannot-catch.md#the-acceptance-pass) completed on a device
- `NEXT_PUBLIC_API_BASE_URL` and `API_BASE_URL` pointing at the production backend, not a local one

## Web deployment

The web application is a standard Next.js build, with one requirement that is easy to
miss.

Offline storage needs **cross-origin isolation**, so the production server must send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`next.config.ts` sends these for `next dev` and `next start`. If you deploy behind your
own nginx, CDN, or a platform that terminates and re-serves the response, they have to be
configured there as well. Without them the local database will not open, and the failure
appears only in production.

---

Related: [What web QA cannot catch](./what-web-qa-cannot-catch.md) for the device pass,
and [The migration](./the-migration.md) for the port itself.
