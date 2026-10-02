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

type MaterialProfile = {
    roughnessCeiling?: number;
    forceNonMetal: boolean;
    metalnessCeiling?: number;
    tintStrength: number;
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
        this.applyMaterialTheme(
            key,
            instance,
            `${key}:${transform.position.join(':')}`,
        );
        this.applyTransform(group, transform);
        this.applyInstanceVariation(key, group, transform);
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
        variationKey: string = key,
    ): void {
        const tint = assetColors[key];
        const profile = this.materialProfile(key);
        const tintVariation =
            this.deterministicUnit(`${variationKey}:tint`) * 0.04;

        object.traverse((child) => {
            const mesh = child as THREE.Mesh;

            if (!mesh.isMesh) {
                return;
            }

            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map((material) =>
                      this.cloneAndThemeMaterial(
                          material,
                          tint,
                          profile,
                          tintVariation,
                      ),
                  )
                : this.cloneAndThemeMaterial(
                      mesh.material,
                      tint,
                      profile,
                      tintVariation,
                  );
        });
    }

    private cloneAndThemeMaterial(
        source: THREE.Material,
        tint: string | undefined,
        profile: MaterialProfile,
        tintVariation: number,
    ): THREE.Material {
        const material = source.clone();

        if (!(material instanceof THREE.MeshStandardMaterial)) {
            material.needsUpdate = true;

            return material;
        }

        material.flatShading = false;

        if (tint) {
            material.color.lerp(
                new THREE.Color(tint),
                Math.min(0.25, profile.tintStrength + tintVariation),
            );
        }

        if (profile.roughnessCeiling !== undefined) {
            material.roughness = Math.min(
                material.roughness,
                profile.roughnessCeiling,
            );
        }

        if (profile.forceNonMetal) {
            material.metalness = 0;
        } else if (profile.metalnessCeiling !== undefined) {
            material.metalness = Math.min(
                material.metalness,
                profile.metalnessCeiling,
            );
        }

        material.needsUpdate = true;

        return material;
    }

    private materialProfile(key: SalemAssetKey): MaterialProfile {
        if (this.isWood(key)) {
            return {
                roughnessCeiling: 0.68,
                forceNonMetal: true,
                tintStrength: 0.12,
            };
        }

        if (this.isVegetation(key)) {
            return {
                roughnessCeiling: 0.72,
                forceNonMetal: true,
                tintStrength: 0.14,
            };
        }

        if (key.startsWith('nature.rock')) {
            return {
                roughnessCeiling: 0.8,
                forceNonMetal: false,
                metalnessCeiling: 0.12,
                tintStrength: 0.1,
            };
        }

        if (key === 'nature.pathRoundWide') {
            return {
                roughnessCeiling: 0.84,
                forceNonMetal: true,
                tintStrength: 0.12,
            };
        }

        return {
            roughnessCeiling: 0.72,
            forceNonMetal: false,
            tintStrength: 0.1,
        };
    }

    private isVegetation(key: SalemAssetKey): boolean {
        return (
            key.startsWith('nature.') &&
            !key.startsWith('nature.rock') &&
            key !== 'nature.pathRoundWide'
        );
    }

    private isWood(key: SalemAssetKey): boolean {
        return (
            key === 'building.homeCabin' ||
            key === 'nature.twistedTree' ||
            key.startsWith('prop.')
        );
    }

    private applyInstanceVariation(
        key: SalemStaticAssetKey,
        object: THREE.Object3D,
        transform: SalemAssetTransform,
    ): void {
        if (!key.startsWith('nature.')) {
            return;
        }

        const identity = `${key}:${transform.position.join(':')}`;
        const scaleVariation =
            0.95 + this.deterministicUnit(`${identity}:scale`) * 0.1;
        const rotationVariation =
            (this.deterministicUnit(`${identity}:rotation`) * 2 - 1) * 0.12;

        object.scale.multiplyScalar(scaleVariation);
        object.rotation.y += rotationVariation;
    }

    private deterministicUnit(value: string): number {
        let hash = 2166136261;

        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0) / 4294967295;
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
