import { describe, expect, it } from 'vitest';

import {
    createSculptedIslandGeometries,
    islandSurfaceY,
} from '@/features/salem/game/scene/terrain-geometry';

const options = {
    radius: 3.4,
    height: 1.5,
    seed: 87,
    scaleX: 1.08,
    scaleZ: 0.94,
    topColor: '#73aa68',
    soilColor: '#6b554a',
    rootColor: '#4f413f',
};

describe('Salem sculpted island geometry', () => {
    it('generates the same terrain for the same seed', () => {
        const first = createSculptedIslandGeometries(options);
        const second = createSculptedIslandGeometries(options);

        expect(positionValues(first.top)).toEqual(positionValues(second.top));
        expect(positionValues(first.cliff)).toEqual(
            positionValues(second.cliff),
        );
        expect(positionValues(first.root)).toEqual(positionValues(second.root));

        dispose(first);
        dispose(second);
    });

    it('creates a visible top, cliff and tapered root below the surface', () => {
        const island = createSculptedIslandGeometries(options);

        island.top.computeBoundingBox();
        island.cliff.computeBoundingBox();
        island.root.computeBoundingBox();

        const topBounds = island.top.boundingBox;
        const cliffBounds = island.cliff.boundingBox;
        const rootBounds = island.root.boundingBox;

        expect(island.surfaceY).toBe(islandSurfaceY(options.height));
        expect(topBounds).not.toBeNull();
        expect(cliffBounds).not.toBeNull();
        expect(rootBounds).not.toBeNull();
        expect(cliffBounds!.max.y).toBeLessThan(topBounds!.max.y);
        expect(rootBounds!.max.y).toBeLessThan(topBounds!.max.y);
        expect(rootBounds!.min.y).toBeLessThan(cliffBounds!.min.y);
        expect(rootBounds!.max.x - rootBounds!.min.x).toBeLessThan(
            cliffBounds!.max.x - cliffBounds!.min.x,
        );

        dispose(island);
    });
});

function positionValues(geometry: {
    getAttribute: (name: string) => { array: ArrayLike<number> };
}): number[] {
    return Array.from(geometry.getAttribute('position').array);
}

function dispose(island: ReturnType<typeof createSculptedIslandGeometries>) {
    island.top.dispose();
    island.cliff.dispose();
    island.root.dispose();
}
