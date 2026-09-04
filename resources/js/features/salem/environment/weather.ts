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
        background: '#9fd7e9',
        fog: '#b7dbe5',
        fogNear: 9,
        fogFar: 29,
        hemisphereSky: '#dff8ff',
        hemisphereGround: '#7c8f68',
        sunlight: '#fff0b8',
        sunlightIntensity: 2.35,
        particleColor: '#ffffff',
        particleCount: 18,
    },
    misty: {
        id: 'misty',
        label: 'Misty',
        background: '#8ea7b8',
        fog: '#aab6c2',
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
        background: '#6f93a4',
        fog: '#86a7b0',
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
        background: '#dda46f',
        fog: '#d39c75',
        fogNear: 8,
        fogFar: 26,
        hemisphereSky: '#ffd7a5',
        hemisphereGround: '#795640',
        sunlight: '#ffcf79',
        sunlightIntensity: 2,
        particleColor: '#ffe0a8',
        particleCount: 26,
    },
    night: {
        id: 'night',
        label: 'Night',
        background: '#2d3d68',
        fog: '#3e5075',
        fogNear: 6,
        fogFar: 24,
        hemisphereSky: '#8093d6',
        hemisphereGround: '#202744',
        sunlight: '#9db7ff',
        sunlightIntensity: 0.75,
        particleColor: '#dce6ff',
        particleCount: 54,
    },
};
