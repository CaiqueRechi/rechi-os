import type { SalemWeather } from '@/types';

import type { SalemStaticAssetKey } from '../game/assets/salem-asset-manifest';

export type IslandBiome =
    | 'home'
    | 'meadow'
    | 'rocky'
    | 'tropical'
    | 'autumn'
    | 'desert'
    | 'tundra'
    | 'mangrove'
    | 'lavender'
    | 'crystal'
    | 'lunar'
    | 'nebula';

export type IslandProp =
    | 'cabin'
    | 'chair'
    | 'laptop'
    | 'trees'
    | 'flowers'
    | 'rocks'
    | 'pool'
    | 'lantern'
    | 'stumps';

export type WaterfallConfig = {
    offset: [number, number, number];
    height: number;
};

export type IslandAssetRole =
    'cabin' | 'chair' | 'trees' | 'flowers' | 'rocks' | 'stumps' | 'decor';

export type IslandAssetPlacement = {
    asset: SalemStaticAssetKey;
    role: IslandAssetRole;
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
};

export type IslandConfig = {
    id: string;
    name: string;
    biome: IslandBiome;
    position: [number, number, number];
    radius: number;
    height: number;
    color: string;
    soilColor: string;
    props: IslandProp[];
    assetPlacements?: IslandAssetPlacement[];
    waterfalls?: WaterfallConfig[];
    weatherHint?: SalemWeather;
};

export const programmingSpot = {
    approach: [1.1, 0.9, 1.55] as [number, number, number],
    seat: [1.92, 1.04, 1.32] as [number, number, number],
    laptop: [2.18, 1.2, 1.03] as [number, number, number],
};

export const salemHome = {
    idle: [0.65, 1.02, 1.34] as [number, number, number],
    sleep: [-1.82, 1.02, 0.72] as [number, number, number],
    inspect: [-2.36, 1.02, 1.22] as [number, number, number],
};

export const islandConfigs: IslandConfig[] = [
    {
        id: 'home',
        name: "Salem's home",
        biome: 'home',
        position: [0, 0, 0],
        radius: 3.6,
        height: 1.15,
        color: '#78b96a',
        soilColor: '#5f463e',
        props: [
            'cabin',
            'chair',
            'laptop',
            'trees',
            'flowers',
            'rocks',
            'lantern',
        ],
        assetPlacements: [
            {
                asset: 'building.homeCabin',
                role: 'cabin',
                position: [-0.95, 0.72, -0.88],
                rotation: [0, -0.35, 0],
                scale: 0.88,
            },
            {
                asset: 'prop.bench',
                role: 'chair',
                position: [1.92, 0.73, 1.2],
                rotation: [0, -0.72, 0],
                scale: 0.7,
            },
            {
                asset: 'nature.treeOakA',
                role: 'trees',
                position: [-2.15, 0.72, -0.1],
                rotation: [0, 0.28, 0],
                scale: 0.18,
            },
            {
                asset: 'nature.treeRound',
                role: 'trees',
                position: [1.28, 0.72, -1.58],
                rotation: [0, -0.46, 0],
                scale: 0.17,
            },
            {
                asset: 'nature.pineA',
                role: 'trees',
                position: [-1.76, 0.72, 1.34],
                rotation: [0, 0.74, 0],
                scale: 0.17,
            },
            {
                asset: 'nature.bushFlowers',
                role: 'flowers',
                position: [-1.2, 0.72, 0.4],
                rotation: [0, 1.2, 0],
                scale: 0.24,
            },
            {
                asset: 'nature.flowerGroup',
                role: 'flowers',
                position: [0.35, 0.72, -0.05],
                rotation: [0, -0.25, 0],
                scale: 0.24,
            },
            {
                asset: 'nature.grassWispy',
                role: 'flowers',
                position: [2.4, 0.72, 0.52],
                rotation: [0, 0.9, 0],
                scale: 0.32,
            },
            {
                asset: 'nature.rockA',
                role: 'rocks',
                position: [0.12, 0.72, 1.7],
                rotation: [0, 0.2, 0],
                scale: 0.28,
            },
            {
                asset: 'nature.rockB',
                role: 'rocks',
                position: [-2.72, 0.72, 0.86],
                rotation: [0, 1.25, 0],
                scale: 0.24,
            },
            {
                asset: 'prop.crate',
                role: 'decor',
                position: [-0.25, 0.73, -1.65],
                rotation: [0, 0.4, 0],
                scale: 0.46,
            },
            {
                asset: 'prop.barrel',
                role: 'decor',
                position: [-1.6, 0.73, -1.55],
                rotation: [0, -0.25, 0],
                scale: 0.5,
            },
            {
                asset: 'prop.fence',
                role: 'decor',
                position: [-1.9, 0.73, -0.92],
                rotation: [0, 0.62, 0],
                scale: 0.58,
            },
        ],
        waterfalls: [{ offset: [-2.6, -0.15, -0.6], height: 5.8 }],
    },
    {
        id: 'meadow',
        name: 'Meadow isle',
        biome: 'meadow',
        position: [-4.8, -0.5, -2.55],
        radius: 1.75,
        height: 0.8,
        color: '#91c76d',
        soilColor: '#6e5644',
        props: ['trees', 'flowers'],
        assetPlacements: [
            {
                asset: 'nature.treeOakB',
                role: 'trees',
                position: [-0.9, 0.55, -0.38],
                rotation: [0, -0.2, 0],
                scale: 0.2,
            },
            {
                asset: 'nature.bushFlowers',
                role: 'flowers',
                position: [0.45, 0.55, 0.24],
                rotation: [0, 0.7, 0],
                scale: 0.22,
            },
            {
                asset: 'nature.flowerGroup',
                role: 'flowers',
                position: [-0.25, 0.55, 0.72],
                rotation: [0, -0.55, 0],
                scale: 0.22,
            },
            {
                asset: 'nature.grass',
                role: 'decor',
                position: [0.85, 0.55, -0.56],
                rotation: [0, 1.4, 0],
                scale: 0.3,
            },
        ],
        weatherHint: 'clear',
    },
    {
        id: 'rocky',
        name: 'Rocky lantern isle',
        biome: 'rocky',
        position: [4.65, -0.85, -3.25],
        radius: 2.05,
        height: 1.25,
        color: '#8f9784',
        soilColor: '#4d4d57',
        props: ['rocks', 'lantern'],
        assetPlacements: [
            {
                asset: 'nature.rockA',
                role: 'rocks',
                position: [-0.7, 0.72, 0.12],
                rotation: [0, 0.28, 0],
                scale: 0.36,
            },
            {
                asset: 'nature.rockB',
                role: 'rocks',
                position: [0.46, 0.72, -0.68],
                rotation: [0, -0.55, 0],
                scale: 0.33,
            },
            {
                asset: 'nature.rockC',
                role: 'rocks',
                position: [1.0, 0.72, 0.42],
                rotation: [0, 1.1, 0],
                scale: 0.26,
            },
            {
                asset: 'nature.pathRoundWide',
                role: 'decor',
                position: [0.18, 0.72, 0.05],
                rotation: [0, 0.18, 0],
                scale: [0.42, 0.42, 0.36],
            },
        ],
        weatherHint: 'misty',
    },
    {
        id: 'tropical',
        name: 'Wet fern isle',
        biome: 'tropical',
        position: [3.55, -1.05, 2.45],
        radius: 1.95,
        height: 0.9,
        color: '#48a879',
        soilColor: '#475846',
        props: ['trees', 'pool', 'rocks'],
        assetPlacements: [
            {
                asset: 'nature.pineB',
                role: 'trees',
                position: [0.98, 0.62, -0.42],
                rotation: [0, 0.15, 0],
                scale: 0.22,
            },
            {
                asset: 'nature.fern',
                role: 'decor',
                position: [-0.95, 0.62, -0.52],
                rotation: [0, 1.25, 0],
                scale: 0.3,
            },
            {
                asset: 'nature.tallGrass',
                role: 'decor',
                position: [0.25, 0.62, 0.78],
                rotation: [0, -0.6, 0],
                scale: 0.32,
            },
            {
                asset: 'nature.rockC',
                role: 'rocks',
                position: [-0.3, 0.62, 1.0],
                rotation: [0, 0.9, 0],
                scale: 0.3,
            },
            {
                asset: 'nature.rockA',
                role: 'rocks',
                position: [1.2, 0.62, 0.62],
                rotation: [0, -0.15, 0],
                scale: 0.26,
            },
        ],
        waterfalls: [{ offset: [1.35, -0.05, 0.25], height: 4.9 }],
        weatherHint: 'rain',
    },
    {
        id: 'autumn',
        name: 'Amber notebook isle',
        biome: 'autumn',
        position: [-3.55, -1.15, 2.75],
        radius: 1.65,
        height: 0.95,
        color: '#c07a42',
        soilColor: '#5f3f35',
        props: ['trees', 'stumps', 'rocks'],
        assetPlacements: [
            {
                asset: 'nature.twistedTree',
                role: 'trees',
                position: [-0.85, 0.66, -0.22],
                rotation: [0, 0.4, 0],
                scale: 0.2,
            },
            {
                asset: 'nature.pineA',
                role: 'trees',
                position: [0.62, 0.66, 0.58],
                rotation: [0, -0.7, 0],
                scale: 0.19,
            },
            {
                asset: 'prop.barrel',
                role: 'stumps',
                position: [0, 0.66, -0.74],
                rotation: [0, 0.25, 0],
                scale: 0.46,
            },
            {
                asset: 'nature.rockB',
                role: 'rocks',
                position: [-0.15, 0.66, 0.62],
                rotation: [0, 1.05, 0],
                scale: 0.3,
            },
        ],
        weatherHint: 'sunset',
    },
    {
        id: 'desert',
        name: 'Dune glass isle',
        biome: 'desert',
        position: [-6.25, -0.95, 0.65],
        radius: 1.42,
        height: 0.72,
        color: '#d0a357',
        soilColor: '#6a4838',
        props: ['rocks', 'stumps'],
        assetPlacements: [
            {
                asset: 'nature.rockC',
                role: 'rocks',
                position: [-0.55, 0.48, -0.25],
                rotation: [0, 0.8, 0],
                scale: 0.32,
            },
            {
                asset: 'nature.rockA',
                role: 'rocks',
                position: [0.62, 0.48, 0.42],
                rotation: [0, -0.3, 0],
                scale: 0.24,
            },
            {
                asset: 'prop.barrel',
                role: 'stumps',
                position: [0.08, 0.48, -0.66],
                rotation: [0, 0.2, 0],
                scale: 0.44,
            },
        ],
        weatherHint: 'sunset',
    },
    {
        id: 'tundra',
        name: 'Frost lichen isle',
        biome: 'tundra',
        position: [6.9, -1.25, 0.1],
        radius: 1.55,
        height: 0.8,
        color: '#b8cdbc',
        soilColor: '#56626b',
        props: ['trees', 'rocks', 'lantern'],
        assetPlacements: [
            {
                asset: 'nature.pineB',
                role: 'trees',
                position: [-0.52, 0.55, -0.2],
                rotation: [0, 0.35, 0],
                scale: 0.2,
            },
            {
                asset: 'nature.rockB',
                role: 'rocks',
                position: [0.55, 0.55, 0.38],
                rotation: [0, 1, 0],
                scale: 0.3,
            },
            {
                asset: 'nature.grassWispy',
                role: 'decor',
                position: [0.2, 0.55, -0.72],
                rotation: [0, -0.4, 0],
                scale: 0.26,
            },
        ],
        weatherHint: 'misty',
    },
    {
        id: 'mangrove',
        name: 'Mangrove tide isle',
        biome: 'mangrove',
        position: [1.25, -1.85, 4.9],
        radius: 1.72,
        height: 0.86,
        color: '#459672',
        soilColor: '#465944',
        props: ['trees', 'pool', 'rocks'],
        assetPlacements: [
            {
                asset: 'nature.twistedTree',
                role: 'trees',
                position: [-0.62, 0.58, -0.35],
                rotation: [0, -0.55, 0],
                scale: 0.17,
            },
            {
                asset: 'nature.fern',
                role: 'decor',
                position: [0.52, 0.58, -0.18],
                rotation: [0, 0.9, 0],
                scale: 0.26,
            },
            {
                asset: 'nature.tallGrass',
                role: 'decor',
                position: [0.1, 0.58, 0.72],
                rotation: [0, -0.1, 0],
                scale: 0.3,
            },
        ],
        waterfalls: [{ offset: [-1.1, -0.08, 0.45], height: 3.9 }],
        weatherHint: 'rain',
    },
    {
        id: 'lavender',
        name: 'Lavender steppe isle',
        biome: 'lavender',
        position: [-1.1, -1.7, -5.45],
        radius: 1.5,
        height: 0.78,
        color: '#9cad70',
        soilColor: '#665469',
        props: ['flowers', 'trees'],
        assetPlacements: [
            {
                asset: 'nature.flowerGroup',
                role: 'flowers',
                position: [-0.45, 0.52, -0.25],
                rotation: [0, 0.3, 0],
                scale: 0.28,
            },
            {
                asset: 'nature.bushFlowers',
                role: 'flowers',
                position: [0.58, 0.52, 0.38],
                rotation: [0, -0.8, 0],
                scale: 0.25,
            },
            {
                asset: 'nature.treeRound',
                role: 'trees',
                position: [0.05, 0.52, -0.68],
                rotation: [0, 0.6, 0],
                scale: 0.17,
            },
        ],
        weatherHint: 'clear',
    },
    {
        id: 'crystal',
        name: 'Prism root isle',
        biome: 'crystal',
        position: [5.35, -2.2, 4.9],
        radius: 1.25,
        height: 0.68,
        color: '#69b8ad',
        soilColor: '#425a68',
        props: ['rocks', 'flowers'],
        assetPlacements: [
            {
                asset: 'nature.rockA',
                role: 'rocks',
                position: [-0.32, 0.45, 0.35],
                rotation: [0, 0.45, 0],
                scale: 0.26,
            },
            {
                asset: 'nature.grass',
                role: 'flowers',
                position: [0.45, 0.45, -0.22],
                rotation: [0, -0.65, 0],
                scale: 0.24,
            },
        ],
        weatherHint: 'night',
    },
    {
        id: 'lunar',
        name: 'Lunar basalt isle',
        biome: 'lunar',
        position: [8.2, -2.65, -3.95],
        radius: 1.36,
        height: 0.95,
        color: '#777d88',
        soilColor: '#3b3e4c',
        props: ['rocks', 'lantern'],
        assetPlacements: [
            {
                asset: 'nature.rockB',
                role: 'rocks',
                position: [-0.5, 0.62, -0.25],
                rotation: [0, 0.35, 0],
                scale: 0.34,
            },
            {
                asset: 'nature.rockC',
                role: 'rocks',
                position: [0.52, 0.62, 0.5],
                rotation: [0, 0.95, 0],
                scale: 0.28,
            },
        ],
        weatherHint: 'night',
    },
    {
        id: 'nebula',
        name: 'Nebula orchard isle',
        biome: 'nebula',
        position: [-7.8, -2.35, -4.2],
        radius: 1.28,
        height: 0.72,
        color: '#6670c9',
        soilColor: '#38375b',
        props: ['trees', 'flowers', 'lantern'],
        assetPlacements: [
            {
                asset: 'nature.treeRound',
                role: 'trees',
                position: [-0.4, 0.48, -0.25],
                rotation: [0, 0.8, 0],
                scale: 0.16,
            },
            {
                asset: 'nature.bushFlowers',
                role: 'flowers',
                position: [0.42, 0.48, 0.22],
                rotation: [0, -0.25, 0],
                scale: 0.2,
            },
            {
                asset: 'nature.grassWispy',
                role: 'decor',
                position: [0.15, 0.48, -0.7],
                rotation: [0, 0.2, 0],
                scale: 0.24,
            },
        ],
        weatherHint: 'night',
    },
];
