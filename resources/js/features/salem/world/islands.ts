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
        color: '#78bf62',
        soilColor: '#8a5a3c',
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
        position: [-6.2, -0.35, -2.8],
        radius: 1.75,
        height: 0.8,
        color: '#86d26b',
        soilColor: '#9a6a42',
        props: ['trees', 'flowers'],
        weatherHint: 'clear',
    },
    {
        id: 'rocky',
        name: 'Rocky lantern isle',
        biome: 'rocky',
        position: [5.8, -0.7, -3.9],
        radius: 2.05,
        height: 1.25,
        color: '#879287',
        soilColor: '#5d5b63',
        props: ['rocks', 'lantern'],
        weatherHint: 'misty',
    },
    {
        id: 'tropical',
        name: 'Wet fern isle',
        biome: 'tropical',
        position: [4.4, -1.15, 2.85],
        radius: 1.95,
        height: 0.9,
        color: '#4fbf85',
        soilColor: '#6d6040',
        props: ['trees', 'pool', 'rocks'],
        waterfalls: [{ offset: [1.35, -0.05, 0.25], height: 4.9 }],
        weatherHint: 'rain',
    },
    {
        id: 'autumn',
        name: 'Amber notebook isle',
        biome: 'autumn',
        position: [-4.3, -1.35, 3.35],
        radius: 1.65,
        height: 0.95,
        color: '#c87a3f',
        soilColor: '#7a4a31',
        props: ['trees', 'stumps', 'rocks'],
        weatherHint: 'sunset',
    },
];
