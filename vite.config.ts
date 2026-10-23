import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    tailwindcss(),
    // DRACOLoader fetches its wrapper/wasm from a directory URL at runtime, so the
    // files must keep stable names; serve them from /draco/ instead of bundling.
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/three/examples/jsm/libs/draco/gltf/draco_{wasm_wrapper.js,decoder.wasm}',
          dest: 'draco',
          rename: { stripBase: true },
        },
      ],
    }),
  ],
});
