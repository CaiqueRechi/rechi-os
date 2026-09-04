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
        background: '#a8dceb',
        fog: '#c7e7ec',
        fogNear: 9,
        fogFar: 29,
        hemisphereSky: '#dff8ff',
        hemisphereGround: '#7c8f68',
        sunlight: '#fff0b8',
        sunlightIntensity: 2.45,
        particleColor: '#ffffff',
        particleCount: 18,
    },
    misty: {
        id: 'misty',
        label: 'Misty',
        background: '#95adb8',
        fog: '#b4c0c5',
        fogNear: 5,
        fogFar: 20,
        hemisphereSky: '#d4e0e7',
        hemisphereGround: '#657070',
        sunlight: '#d9edf2',
        sunlightIntensity: 1.4,
        particleColor: '#dbe7ee',
        particleCount: 42,
    },
    rain: {
        id: 'rain',
        label: 'Light Rain',
        background: '#728f9e',
        fog: '#90aab1',
        fogNear: 6,
        fogFar: 22,
        hemisphereSky: '#b9d1d9',
        hemisphereGround: '#425f59',
        sunlight: '#b9d7da',
        sunlightIntensity: 1.25,
        particleColor: '#bfeeff',
        particleCount: 80,
    },
    sunset: {
        id: 'sunset',
        label: 'Sunset',
        background: '#d69475',
        fog: '#e2ad87',
        fogNear: 8,
        fogFar: 26,
        hemisphereSky: '#ffe2ba',
        hemisphereGround: '#735b55',
        sunlight: '#ffd38a',
        sunlightIntensity: 2.35,
        particleColor: '#fff0bd',
        particleCount: 26,
    },
    night: {
        id: 'night',
        label: 'Night',
        background: '#283351',
        fog: '#3d4962',
        fogNear: 6,
        fogFar: 24,
        hemisphereSky: '#a9b8dc',
        hemisphereGround: '#2c3142',
        sunlight: '#b7c8ff',
        sunlightIntensity: 0.95,
        particleColor: '#f6e6c0',
        particleCount: 38,
    },
};
