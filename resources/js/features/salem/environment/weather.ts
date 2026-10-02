import type { SalemWeather } from '@/types';

export type WeatherPreset = {
    id: SalemWeather;
    label: string;
    background: string;
    fog: string;
    fogNear: number;
    fogFar: number;
    hemisphereSky: string;
    hemisphereGround: string;
    sunlight: string;
    sunlightIntensity: number;
    particleColor: string;
    particleCount: number;
};

export const weatherPresets: Record<SalemWeather, WeatherPreset> = {
    clear: {
        id: 'clear',
        label: 'Clear',
        background: '#a9d1db',
        fog: '#c9dde0',
        fogNear: 12,
        fogFar: 30,
        hemisphereSky: '#ddf2f4',
        hemisphereGround: '#7d8d73',
        sunlight: '#ffefc7',
        sunlightIntensity: 2.25,
        particleColor: '#ffffff',
        particleCount: 12,
    },
    misty: {
        id: 'misty',
        label: 'Misty',
        background: '#98aeb6',
        fog: '#b8c3c5',
        fogNear: 10,
        fogFar: 24,
        hemisphereSky: '#d4e0e7',
        hemisphereGround: '#657070',
        sunlight: '#d9edf2',
        sunlightIntensity: 1.3,
        particleColor: '#dbe7ee',
        particleCount: 28,
    },
    rain: {
        id: 'rain',
        label: 'Light Rain',
        background: '#788e99',
        fog: '#94a8ad',
        fogNear: 10,
        fogFar: 24,
        hemisphereSky: '#b9d1d9',
        hemisphereGround: '#425f59',
        sunlight: '#b9d7da',
        sunlightIntensity: 1.15,
        particleColor: '#bfeeff',
        particleCount: 44,
    },
    sunset: {
        id: 'sunset',
        label: 'Sunset',
        background: '#b8949f',
        fog: '#c8ada8',
        fogNear: 11,
        fogFar: 28,
        hemisphereSky: '#f3d5c0',
        hemisphereGround: '#777174',
        sunlight: '#ffd8a3',
        sunlightIntensity: 1.95,
        particleColor: '#fbe8cf',
        particleCount: 18,
    },
    night: {
        id: 'night',
        label: 'Night',
        background: '#2e3850',
        fog: '#46516a',
        fogNear: 10,
        fogFar: 26,
        hemisphereSky: '#a9b8dc',
        hemisphereGround: '#2c3142',
        sunlight: '#b7c8ff',
        sunlightIntensity: 0.9,
        particleColor: '#f6e6c0',
        particleCount: 24,
    },
};
