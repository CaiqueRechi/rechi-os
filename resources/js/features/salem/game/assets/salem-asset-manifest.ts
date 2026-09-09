export const salemCharacterAssets = {
    salem: '/assets/salem/models/characters/salem-cat-quaternius.glb',
} as const;

export const salemStaticAssets = {
    'building.homeCabin': '/assets/salem/models/buildings/home-cabin.glb',
    'nature.bush': '/assets/salem/models/environment/bush.glb',
    'nature.bushFlowers': '/assets/salem/models/environment/bush-flowers.glb',
    'nature.fern': '/assets/salem/models/environment/fern.glb',
    'nature.flowerGroup': '/assets/salem/models/environment/flower-group.glb',
    'nature.grass': '/assets/salem/models/environment/grass.glb',
    'nature.grassWispy': '/assets/salem/models/environment/grass-wispy.glb',
    'nature.pathRoundWide':
        '/assets/salem/models/environment/path-round-wide.glb',
    'nature.pineA': '/assets/salem/models/environment/pine-a.glb',
    'nature.pineB': '/assets/salem/models/environment/pine-b.glb',
    'nature.rockA': '/assets/salem/models/environment/rock-medium-a.glb',
    'nature.rockB': '/assets/salem/models/environment/rock-medium-b.glb',
    'nature.rockC': '/assets/salem/models/environment/rock-medium-c.glb',
    'nature.tallGrass': '/assets/salem/models/environment/tall-grass.glb',
    'nature.treeOakA': '/assets/salem/models/environment/tree-oak-a.glb',
    'nature.treeOakB': '/assets/salem/models/environment/tree-oak-b.glb',
    'nature.treeRound': '/assets/salem/models/environment/tree-round.glb',
    'nature.twistedTree': '/assets/salem/models/environment/twisted-tree.glb',
    'prop.barrel': '/assets/salem/models/props/barrel.glb',
    'prop.bench': '/assets/salem/models/props/bench.glb',
    'prop.crate': '/assets/salem/models/props/crate.glb',
    'prop.fence': '/assets/salem/models/props/fence.glb',
} as const;

export type SalemCharacterAssetKey = keyof typeof salemCharacterAssets;
export type SalemStaticAssetKey = keyof typeof salemStaticAssets;
