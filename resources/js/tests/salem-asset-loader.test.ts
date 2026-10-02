import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { SalemAssetLoader } from '@/features/salem/game/assets/SalemAssetLoader';

describe('SalemAssetLoader material theming', () => {
    it('clones GLB materials while preserving their texture maps', () => {
        const loader = new SalemAssetLoader();
        const colorMap = new THREE.Texture();
        const normalMap = new THREE.Texture();
        const roughnessMap = new THREE.Texture();
        const original = new THREE.MeshStandardMaterial({
            color: '#718096',
            map: colorMap,
            normalMap,
            roughnessMap,
            roughness: 0.96,
            metalness: 0.45,
            flatShading: true,
            vertexColors: true,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);

        loader.applyMaterialTheme('nature.rockA', mesh);

        const themed = mesh.material as THREE.MeshStandardMaterial;

        expect(themed).not.toBe(original);
        expect(themed.map).toBe(colorMap);
        expect(themed.normalMap).toBe(normalMap);
        expect(themed.roughnessMap).toBe(roughnessMap);
        expect(themed.vertexColors).toBe(true);
        expect(themed.flatShading).toBe(false);
        expect(themed.roughness).toBeLessThanOrEqual(0.8);
        expect(themed.metalness).toBeLessThanOrEqual(0.12);
        expect(themed.version).toBeGreaterThan(0);
    });

    it('keeps original materials untouched when an instance is themed', () => {
        const loader = new SalemAssetLoader();
        const original = new THREE.MeshStandardMaterial({
            color: '#356b46',
            roughness: 0.88,
            metalness: 0.18,
            flatShading: true,
        });
        const originalColor = original.color.clone();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);

        loader.applyMaterialTheme('nature.fern', mesh, 'fern-instance-1');

        expect(original.color.equals(originalColor)).toBe(true);
        expect(original.roughness).toBe(0.88);
        expect(original.metalness).toBe(0.18);
        expect(original.flatShading).toBe(true);
    });
});
