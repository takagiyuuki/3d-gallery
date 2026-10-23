# 3d-gallery

Viewer site for self-made 3DCG models (`3d.yukit.dev`). Vite + TypeScript (vanilla) + three.js,
styled with Tailwind CSS v4 and daisyUI v5.

This repository contains **only the site code**. Models (GLB, thumbnails) and the manifest
(`models/index.json`) are published to Cloudflare R2 by the separate `3d-models` repository; the
viewer fetches the manifest at runtime, so adding a model needs no change or deploy here.

## Getting started

Requirements: Nix with flakes + direnv (provides Node 24, pnpm, gitleaks, lefthook).

```sh
direnv allow          # or: nix develop
pnpm install          # also installs the lefthook git hooks
pnpm fixtures         # download sample models into public/dev-models/ (gitignored)
pnpm dev              # http://localhost:5173/?model=fox
```

`pnpm fixtures --with-broken` additionally adds an entry pointing to a missing GLB, to check the
load error UI.

### Commands

| Command                     | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                  | Dev server                                                  |
| `pnpm build`                | Type check (`tsc --noEmit`) and production build to `dist/` |
| `pnpm preview`              | Serve the production build                                  |
| `pnpm test`                 | Unit tests (Vitest)                                         |
| `pnpm lint` / `pnpm format` | Biome                                                       |
| `pnpm verify`               | lint + typecheck + test + build (also run on pre-push)      |

### Configuration

| Variable            | Description                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_MANIFEST_URL` | Manifest URL (absolute, or relative to the page). Optional in dev (defaults to `/dev-models/index.json`); **required** for production builds. See `.env.example`. |

When the manifest is served from another origin (e.g. an R2 custom domain), that origin must allow
CORS `GET` for the manifest and the GLB files.

## Manifest format

```jsonc
{
  "version": 1,
  "generatedAt": "2026-10-21T00:00:00Z", // optional
  "models": [
    {
      "id": "robot", // [a-z0-9-], used in ?model=
      "name": "Robot",
      "glb": "robot/model.glb", // relative to index.json
      "thumbnail": "robot/thumbnail.webp", // optional
      "stats": {
        // optional; every field optional
        "triangles": 12400,
        "textureCount": 2,
        "maxTextureSize": 2048,
        "drawCalls": 6,
        "fileSizeBytes": 3250585
      },
      "notes": "制作メモ", // optional
      "credit": { "author": "…", "license": "CC-BY-4.0", "url": "https://…" } // optional
    }
  ]
}
```

The schema lives in `src/manifest/schema.ts` (valibot only). An invalid top level shows an error;
invalid or duplicate entries are skipped with a console warning. Whether a model is animated is
detected from the GLB, not stored in the manifest. Draco- and Meshopt-compressed GLBs are supported.

## Sample model credits

`pnpm fixtures` downloads these models from the Khronos
[glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) repository (pinned commit)
for local development only. They are not committed or deployed. Water Bottle and Lantern are
re-encoded with Meshopt / Draco by the script.

| Model                                                                                           | Credit                                                                                         | License                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Fox](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox)                  | Model: PixelMannen. Rigging & animation: tomkranis. glTF conversion: @AsoboStudio and @scurest | Model CC0 1.0; rigging, animation and conversion [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Water Bottle](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/WaterBottle) | Microsoft                                                                                      | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                              |
| [Lantern](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern)          | sbtron (Microsoft); Draco compression by Frank Galligan                                        | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                              |

## Notes

- Fonts: Noto Sans JP (SIL Open Font License 1.1), self-hosted via `@fontsource-variable/noto-sans-jp`.
- Pre-commit runs gitleaks, Biome and the type check (lefthook). Never commit model data; Git LFS is not used.
