# Salem Asset Manifest

The public `/salem` scene uses bundled low-poly GLB assets for the main cat,
home island scenery, vegetation, rocks and props. Runtime primitive meshes remain
only for terrain, water, lighting, particles, the laptop interaction and fallback
rendering if a model cannot load.

See `ASSET_CREDITS.md` for source and license details.

## Runtime Manifest

- Character: `public/assets/salem/models/characters/salem-cat-quaternius.glb`
- Buildings: `public/assets/salem/models/buildings/home-cabin.glb`
- Environment:
  `public/assets/salem/models/environment/{bush,bush-flowers,fern,flower-group,grass,grass-wispy,path-round-wide,pine-a,pine-b,rock-medium-a,rock-medium-b,rock-medium-c,tall-grass,tree-oak-a,tree-oak-b,tree-round,twisted-tree}.glb`
- Props: `public/assets/salem/models/props/{barrel,bench,crate,fence}.glb`

## Modification Notes

- Models were downloaded as GLB/GLTF sources from Poly Pizza and Quaternius.
- Models were optimized locally for web delivery with glTF Transform, WebP
  textures and reduced texture size.
- The previous CC-BY cat model was removed from the runtime bundle.
