# Catalyst documentation site

The documentation site for the **Catalyst stack** - the engine
([offline-kit](https://github.com/8848digital/offline-kit)), the chassis
([catalyst](https://github.com/8848digital/catalyst)), and the starter
([reactant](https://github.com/8848digital/reactant)).

Built with [Docusaurus](https://docusaurus.io/).

## Use pnpm, not npm

This project is **pnpm-only**. `packageManager` is pinned to `pnpm@11.0.8`, and
build-script permissions live in `pnpm-workspace.yaml` (`allowBuilds`) - a setting
npm does not read.

Running `npm install` here crashes: npm's dependency resolver walks pnpm's
symlink store under `node_modules/.pnpm/` and fails with
`Cannot read properties of null (reading 'matches')`. It fails while planning,
so it does no damage - but it will never succeed. Use pnpm.

## Install

```bash
pnpm install
```

## Local development

```bash
pnpm start
```

Serves at <http://localhost:3000/catalyst-docs/> with live reload.

> Note: reactant's web app also uses port 3000. To run both, pass
> `pnpm start --port 3001`.

## Build

```bash
pnpm build      # static output into build/
pnpm serve      # preview the production build locally
pnpm typecheck  # tsc --noEmit
```

`onBrokenLinks` is set to `throw`, so a dead internal link fails the build. That
is deliberate - it keeps cross-references honest as the docs grow.

## Deployment

Published to GitHub Pages at <https://8848digital.github.io/catalyst-docs/>.

Every push to `main` triggers `.github/workflows/deploy.yml`, which builds and
deploys. Because `onBrokenLinks` is `throw`, a dead link fails the deploy rather
than shipping a broken page.
