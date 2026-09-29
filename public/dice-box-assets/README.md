# Dice tray static assets

Copied verbatim from `node_modules/@3d-dice/dice-box/dist/assets` (the
`@3d-dice/dice-box` package - see `src/components/DiceTray.js`). Served as
plain static files so the 3D dice engine can fetch its physics WASM binary
and dice models/textures at runtime, independent of the JS bundle.

Re-copy this folder (`ammo/`, `themes/`) whenever `@3d-dice/dice-box` is
upgraded, in case its assets changed:

```bash
rm -rf public/dice-box-assets/ammo public/dice-box-assets/themes
cp -r node_modules/@3d-dice/dice-box/dist/assets/* public/dice-box-assets/
```

This `README.md` itself is not part of the package - keep it when re-copying.
