import * as THREE from 'three';

export type SculptedIslandGeometryOptions = {
    radius: number;
    height: number;
    seed: number;
    scaleX: number;
    scaleZ: number;
    topColor: string;
    soilColor: string;
    rootColor: string;
};

export type SculptedIslandGeometries = {
    top: THREE.BufferGeometry;
    cliff: THREE.BufferGeometry;
    root: THREE.BufferGeometry;
    surfaceY: number;
};

const radialSegments = 32;

export function islandSurfaceY(height: number): number {
    return height * 0.5 + 0.15;
}

export function createSculptedIslandGeometries(
    options: SculptedIslandGeometryOptions,
): SculptedIslandGeometries {
    const surfaceY = islandSurfaceY(options.height);

    return {
        top: createTopGeometry(options, surfaceY),
        cliff: createCliffGeometry(options, surfaceY),
        root: createRootGeometry(options, surfaceY),
        surfaceY,
    };
}

function createTopGeometry(
    options: SculptedIslandGeometryOptions,
    surfaceY: number,
): THREE.BufferGeometry {
    const ringCount = 4;
    const positions: number[] = [0, surfaceY + 0.012, 0];
    const colors: number[] = [];
    const indices: number[] = [];
    const topColor = new THREE.Color(options.topColor);

    pushColor(colors, variedColor(topColor, options.seed, 0, 0.018));

    for (let ring = 1; ring <= ringCount; ring += 1) {
        const progress = ring / ringCount;

        for (let segment = 0; segment < radialSegments; segment += 1) {
            const angle = (segment / radialSegments) * Math.PI * 2;
            const edge = boundaryScale(angle, options.seed);
            const radius =
                options.radius *
                progress *
                THREE.MathUtils.lerp(1, edge, progress * progress);
            const heightNoise =
                surfaceNoise(angle, progress, options.seed) *
                    (0.014 + progress * 0.026) -
                Math.pow(progress, 5) * 0.045;

            positions.push(
                Math.cos(angle) * radius * options.scaleX,
                surfaceY + heightNoise,
                Math.sin(angle) * radius * options.scaleZ,
            );
            pushColor(
                colors,
                variedColor(topColor, options.seed + ring * 37, segment, 0.024),
            );
        }
    }

    for (let segment = 0; segment < radialSegments; segment += 1) {
        indices.push(0, 1 + segment, 1 + ((segment + 1) % radialSegments));
    }

    for (let ring = 1; ring < ringCount; ring += 1) {
        const innerStart = 1 + (ring - 1) * radialSegments;
        const outerStart = 1 + ring * radialSegments;

        connectRings(indices, innerStart, outerStart, radialSegments);
    }

    return buildGeometry(positions, colors, indices);
}

function createCliffGeometry(
    options: SculptedIslandGeometryOptions,
    surfaceY: number,
): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const soil = new THREE.Color(options.soilColor);
    const levels = [
        { radius: 1, y: surfaceY - 0.035, lightness: 0.045 },
        {
            radius: 0.91,
            y: surfaceY - options.height * 0.34,
            lightness: 0,
        },
        {
            radius: 0.77,
            y: surfaceY - options.height * 0.66,
            lightness: -0.055,
        },
    ];

    levels.forEach((level, levelIndex) => {
        for (let segment = 0; segment < radialSegments; segment += 1) {
            const angle = (segment / radialSegments) * Math.PI * 2;
            const edge = boundaryScale(angle, options.seed);
            const erosion =
                1 +
                shapeNoise(angle + levelIndex * 0.47, options.seed + 53) *
                    (0.035 + levelIndex * 0.025);
            const radius = options.radius * level.radius * edge * erosion;
            const y =
                level.y +
                shapeNoise(angle + 0.81, options.seed + levelIndex * 31) *
                    options.height *
                    0.035;

            positions.push(
                Math.cos(angle) * radius * options.scaleX,
                y,
                Math.sin(angle) * radius * options.scaleZ,
            );
            const color = soil.clone().offsetHSL(0, -0.015, level.lightness);
            pushColor(colors, color);
        }
    });

    for (let level = 0; level < levels.length - 1; level += 1) {
        connectRings(
            indices,
            level * radialSegments,
            (level + 1) * radialSegments,
            radialSegments,
        );
    }

    return buildGeometry(positions, colors, indices);
}

function createRootGeometry(
    options: SculptedIslandGeometryOptions,
    surfaceY: number,
): THREE.BufferGeometry {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const root = new THREE.Color(options.rootColor);
    const rootDepth = Math.max(options.height * 0.82, options.radius * 0.43);
    const rootTop = surfaceY - options.height * 0.64;
    const levels = [
        { radius: 0.79, y: rootTop, lightness: 0.04 },
        {
            radius: 0.66,
            y: rootTop - rootDepth * 0.28,
            lightness: 0.015,
        },
        {
            radius: 0.45,
            y: rootTop - rootDepth * 0.62,
            lightness: -0.02,
        },
        {
            radius: 0.25,
            y: rootTop - rootDepth * 0.88,
            lightness: -0.045,
        },
    ];

    levels.forEach((level, levelIndex) => {
        const driftX =
            shapeNoise(levelIndex * 0.91, options.seed + 181) *
            options.radius *
            0.055;
        const driftZ =
            shapeNoise(levelIndex * 1.17, options.seed + 233) *
            options.radius *
            0.055;

        for (let segment = 0; segment < radialSegments; segment += 1) {
            const angle = (segment / radialSegments) * Math.PI * 2;
            const lobes =
                1 +
                shapeNoise(angle + levelIndex * 0.36, options.seed + 97) *
                    (0.11 + levelIndex * 0.025);
            const radius = options.radius * level.radius * lobes;
            const y =
                level.y +
                shapeNoise(angle + 0.35, options.seed + levelIndex * 47) *
                    rootDepth *
                    0.035;

            positions.push(
                Math.cos(angle) * radius * options.scaleX + driftX,
                y,
                Math.sin(angle) * radius * options.scaleZ + driftZ,
            );
            pushColor(
                colors,
                root.clone().offsetHSL(0, -0.01, level.lightness),
            );
        }
    });

    for (let level = 0; level < levels.length - 1; level += 1) {
        connectRings(
            indices,
            level * radialSegments,
            (level + 1) * radialSegments,
            radialSegments,
        );
    }

    const tipIndex = positions.length / 3;
    const tipX = shapeNoise(0.42, options.seed + 307) * options.radius * 0.08;
    const tipZ = shapeNoise(1.24, options.seed + 353) * options.radius * 0.08;
    positions.push(tipX, rootTop - rootDepth * 1.08, tipZ);
    pushColor(colors, root.clone().offsetHSL(0, -0.01, -0.065));

    const lastRing = (levels.length - 1) * radialSegments;

    for (let segment = 0; segment < radialSegments; segment += 1) {
        indices.push(
            lastRing + segment,
            tipIndex,
            lastRing + ((segment + 1) % radialSegments),
        );
    }

    return buildGeometry(positions, colors, indices);
}

function boundaryScale(angle: number, seed: number): number {
    return 1 + shapeNoise(angle, seed) * 0.125;
}

function surfaceNoise(angle: number, progress: number, seed: number): number {
    return (
        Math.sin(angle * 2 + seed * 0.011 + progress * 3.1) * 0.5 +
        Math.sin(angle * 5 - seed * 0.007 + progress * 5.7) * 0.3 +
        Math.sin(angle * 7 + seed * 0.003) * 0.2
    );
}

function shapeNoise(angle: number, seed: number): number {
    const phase = (seed % 997) * 0.017;

    return (
        Math.sin(angle * 3 + phase) * 0.48 +
        Math.sin(angle * 5 - phase * 0.73) * 0.32 +
        Math.sin(angle * 7 + phase * 1.31) * 0.2
    );
}

function connectRings(
    indices: number[],
    innerStart: number,
    outerStart: number,
    segments: number,
): void {
    for (let segment = 0; segment < segments; segment += 1) {
        const next = (segment + 1) % segments;
        const inner = innerStart + segment;
        const innerNext = innerStart + next;
        const outer = outerStart + segment;
        const outerNext = outerStart + next;

        indices.push(inner, outer, outerNext, inner, outerNext, innerNext);
    }
}

function variedColor(
    base: THREE.Color,
    seed: number,
    index: number,
    strength: number,
): THREE.Color {
    const variation = Math.sin(index * 12.9898 + seed * 0.017) * strength;

    return base.clone().offsetHSL(0, -0.01, variation);
}

function pushColor(target: number[], color: THREE.Color): void {
    target.push(color.r, color.g, color.b);
}

function buildGeometry(
    positions: number[],
    colors: number[],
    indices: number[],
): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    return geometry;
}
