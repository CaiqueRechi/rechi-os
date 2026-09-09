import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
    salemCharacterAssets,
    salemStaticAssets,
} from './salem-asset-manifest';
import type {
    SalemCharacterAssetKey,
    SalemStaticAssetKey,
} from './salem-asset-manifest';

type SalemAssetKey = SalemCharacterAssetKey | SalemStaticAssetKey;

export type SalemAssetTransform = {
    position: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
};

const assetPaths: Record<SalemAssetKey, string> = {
    ...salemCharacterAssets,
    ...salemStaticAssets,
};

const assetColors: Partial<Record<SalemAssetKey, string>> = {
    salem: '#1c1d24',
    'building.homeCabin': '#a86a42',
    'nature.bush': '#4f9c5f',
    'nature.bushFlowers': '#65a957',
    'nature.fern': '#2e8f61',
    'nature.flowerGroup': '#eeb3c6',
    'nature.grass': '#72ad57',
    'nature.grassWispy': '#8bbb62',
    'nature.pathRoundWide': '#c1a77d',
    'nature.pineA': '#2f7d54',
    'nature.pineB': '#1d8064',
    'nature.rockA': '#8d9188',
    'nature.rockB': '#777d7b',
    'nature.rockC': '#9a9585',
    'nature.tallGrass': '#78a95b',
    'nature.treeOakA': '#3f8b55',
    'nature.treeOakB': '#67a85a',
    'nature.treeRound': '#4c9955',
    'nature.twistedTree': '#b66a42',
    'prop.barrel': '#815237',
    'prop.bench': '#7b5036',
    'prop.crate': '#98643e',
    'prop.fence': '#73513b',
};

export class SalemAssetLoader {
    private readonly loader = new GLTFLoader();

    private readonly cache = new Map<SalemAssetKey, Promise<GLTF>>();

    public load(key: SalemAssetKey): Promise<GLTF> {
        const existing = this.cache.get(key);

        if (existing) {
            return existing;
        }

        const request = this.loader.loadAsync(assetPaths[key]);
        this.cache.set(key, request);

        return request;
    }

    public async createStaticInstance(
        key: SalemStaticAssetKey,
        transform: SalemAssetTransform,
    ): Promise<THREE.Group> {
        const gltf = await this.load(key);
        const instance = gltf.scene.clone(true);
        const group = new THREE.Group();

        this.configureShadows(instance);
        this.applyMaterialTheme(key, instance);
        this.applyTransform(group, transform);
        group.add(instance);

        return group;
    }

    public configureShadows(object: THREE.Object3D): void {
        object.traverse((child) => {
            const mesh = child as THREE.Mesh;

            if (!mesh.isMesh) {
                return;
            }

            mesh.castShadow = true;
            mesh.receiveShadow = true;
        });
    }

    public applyMaterialTheme(
        key: SalemAssetKey,
        object: THREE.Object3D,
    ): void {
        const color = assetColors[key];

        if (!color) {
            return;
        }

        object.traverse((child) => {
            const mesh = child as THREE.Mesh;

            if (!mesh.isMesh) {
                return;
            }

            mesh.material = new THREE.MeshStandardMaterial({
                color,
                roughness: 0.82,
                metalness: 0,
                flatShading: true,
            });
        });
    }

    private applyTransform(
        object: THREE.Object3D,
        transform: SalemAssetTransform,
    ): void {
        object.position.set(...transform.position);

        if (transform.rotation) {
            object.rotation.set(...transform.rotation);
        }

        if (Array.isArray(transform.scale)) {
            object.scale.set(...transform.scale);

            return;
        }

        if (transform.scale !== undefined) {
            object.scale.setScalar(transform.scale);
        }
    }
}
