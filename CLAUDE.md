# CLAUDE.md — 3d-gallery

3DCG model viewer site (`3d.yukit.dev`). This repository holds **only the site (viewer) code**.
Model data (GLB / thumbnails / manifest) lives in Cloudflare R2, managed by the separate `3d-models` repository.

## Mode

**実装委任モード (Implementation Delegation Mode).** Claude may edit files and commit without
per-change instructions. Destructive / irreversible / outward-facing operations (push, PR, deploy,
deletion) still require confirmation first.

## Conventions

- Never commit GLB or other model data. No Git LFS. Local fixtures go to `public/dev-models/` (gitignored).
- Code comments, commit messages and PR descriptions are in English. Commit in small units
  (Conventional Commits).
- VCS: use **git** only, even though `.jj/` may exist (the owner is learning git internals).
- Package manager: **pnpm**. Toolchain comes from `flake.nix` via direnv (`use flake`).
- Pre-commit: lefthook runs gitleaks (staged), biome, typecheck. Pre-push: gitleaks (history) + `pnpm verify`.
- Verify library APIs against official docs before writing version-dependent code
  (Tailwind v4 / daisyUI v5 / three.js change between majors).

## Commands

| Command                                                      | Purpose                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `pnpm dev`                                                   | Vite dev server                                                            |
| `pnpm fixtures`                                              | Download Khronos sample models and generate `public/dev-models/index.json` |
| `pnpm fixtures --with-broken`                                | Same, plus an entry with a missing GLB (error UI check)                    |
| `pnpm build`                                                 | `tsc --noEmit` + `vite build`                                              |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` / `pnpm test` | Individual checks                                                          |
| `pnpm verify`                                                | lint + typecheck + test + build (run by pre-push)                          |

Environment: `VITE_MANIFEST_URL` (see `.env.example`). Defaults to `/dev-models/index.json` in dev only.

## Layout

```
src/
  main.ts              bootstrap: WebGL check → manifest → viewer → UI → router
  manifest/schema.ts   valibot schema + types; depends only on valibot (may be shared with 3d-models)
  viewer/              framework-agnostic three.js viewer: createViewer(canvas, options)
  ui/                  vanilla DOM renderers + tiny store
  router.ts            ?model=<id> <-> state (pushState / popstate)
scripts/fixtures.ts    dev fixture generator (Node 24 native TS)
```

## Viewer invariants

- Switching models must `dispose()` all geometries, materials and textures of the previous model.
  Check with `window.__viewer.renderer.info.memory` in dev.
- A superseded load is aborted (fetch) or discarded and disposed after parse; it must never be shown.
- The viewer knows nothing about the DOM layout; the UI passes `setInsets()` and the viewer centers
  the model in the uncovered area via `camera.setViewOffset`.
- Manifest data is untrusted: render text with `textContent`, never `innerHTML`.
