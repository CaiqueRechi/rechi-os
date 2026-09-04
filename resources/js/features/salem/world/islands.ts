import type { SalemWeather } from '@/types';

export type IslandBiome = 'home' | 'meadow' | 'rocky' | 'tropical' | 'autumn';

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
    waterfalls?: WaterfallConfig[];
    weatherHint?: SalemWeather;
};

export const programmingSpot = {
    approach: [1.1, 0.68, 1.55] as [number, number, number],
    seat: [1.92, 0.92, 1.32] as [number, number, number],
    laptop: [2.18, 1.2, 1.03] as [number, number, number],
};

export const salemHome = {
    idle: [0, 0.7, 0.45] as [number, number, number],
    sleep: [-1.3, 0.72, -1.05] as [number, number, number],
    inspect: [-2.05, 0.73, 0.9] as [number, number, number],
};

export const islandConfigs: IslandConfig[] = [
    {
        id: 'home',
        name: "Salem's home",
        biome: 'home',
        position: [0, 0, 0],
        radius: 3.6,
        height: 1.15,
        color: '#6fb866',
        soilColor: '#6e4f45',
        props: [
            'cabin',
            'chair',
            'laptop',
            'trees',
            'flowers',
            'rocks',
            'lantern',
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
        color: '#78c96e',
        soilColor: '#795b45',
        props: ['trees', 'flowers'],
        weatherHint: 'clear',
    },
    {
        id: 'rocky',
        name: 'Rocky lantern isle',
        biome: 'rocky',
        position: [4.65, -0.85, -3.25],
        radius: 2.05,
        height: 1.25,
        color: '#7d8b86',
        soilColor: '#54535d',
        props: ['rocks', 'lantern'],
        weatherHint: 'misty',
    },
    {
        id: 'tropical',
        name: 'Wet fern isle',
        biome: 'tropical',
        position: [3.55, -1.05, 2.45],
        radius: 1.95,
        height: 0.9,
        color: '#43ad83',
        soilColor: '#545845',
        props: ['trees', 'pool', 'rocks'],
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
        color: '#b56c47',
        soilColor: '#654338',
        props: ['trees', 'stumps', 'rocks'],
        weatherHint: 'sunset',
    },
];
