import * as THREE from 'three';

import type { SalemAction, SalemWeather } from '@/types';

import { weatherPresets } from '../../environment/weather';
import { actionDuration, sequenceStepAt } from '../../state/salem-actions';
import { salemHome, islandConfigs, programmingSpot } from '../../world/islands';
import type {
    IslandAssetPlacement,
    IslandAssetRole,
    IslandBiome,
    IslandConfig,
} from '../../world/islands';
import { SalemAssetLoader } from '../assets/SalemAssetLoader';
import {
    createSculptedIslandGeometries,
    islandSurfaceY,
} from './terrain-geometry';

type SalemSceneOptions = {
    onActionChange: (action: SalemAction) => void;
    onActionRequest: (action: SalemAction) => void;
    onAssetError: (message: string) => void;
    onWeatherChange: (weather: SalemWeather) => void;
};

type Waterfall = {
    stream: THREE.Mesh;
    droplets: THREE.InstancedMesh;
    speed: number;
    height: number;
    topY: number;
};

type InteractionTarget = {
    action: SalemAction;
    target?: THREE.Vector3;
    weather?: SalemWeather;
};

type FloatingIsland = {
    group: THREE.Group;
    baseY: number;
    phase: number;
    speed: number;
    amplitude: number;
};

type AnimatedFeature = {
    object: THREE.Object3D;
    baseY: number;
    phase: number;
    spin: number;
    bob: number;
};

export type SalemSceneHandle = {
    forceAction: (action: SalemAction) => void;
    moveTo: (target: [number, number, number]) => void;
    resetPosition: () => void;
    setWeather: (weather: SalemWeather) => void;
    dispose: () => void;
};

export class SalemScene implements SalemSceneHandle {
    private readonly scene = new THREE.Scene();

    private readonly root = new THREE.Group();

    private readonly atmosphere = new THREE.Group();

    private readonly raycaster = new THREE.Raycaster();

    private readonly pointer = new THREE.Vector2();

    private readonly camera: THREE.PerspectiveCamera;

    private readonly renderer: THREE.WebGLRenderer;

    private readonly assetLoader = new SalemAssetLoader();

    private readonly waterFalls: Waterfall[] = [];

    private readonly weatherParticles: THREE.InstancedMesh[] = [];

    private readonly laptopCodeLines: THREE.Mesh[] = [];

    private readonly interactionTargets = new Map<
        THREE.Object3D,
        InteractionTarget
    >();

    private readonly floatingIslands: FloatingIsland[] = [];

    private readonly animatedFeatures: AnimatedFeature[] = [];

    private readonly programmingPaws = new THREE.Group();

    private readonly fallbackSalem = new THREE.Group();

    private readonly catAnchor = new THREE.Group();

    private readonly options: SalemSceneOptions;

    private salemBody?: THREE.Object3D;

    private salemHead?: THREE.Object3D;

    private salemTail?: THREE.Object3D;

    private readonly salemEyes: THREE.Object3D[] = [];

    private animationFrame: number | null = null;

    private lastRenderAt = 0;

    private lastTickAt = performance.now();

    private elapsedSeconds = 0;

    private sunlight?: THREE.DirectionalLight;

    private hemisphere?: THREE.HemisphereLight;

    private laptopGlow?: THREE.PointLight;

    private laptopScreen?: THREE.MeshStandardMaterial;

    private currentAction: SalemAction = 'idle';

    private actionStartedAt = performance.now();

    private rootRotation = -0.28;

    private manualMoveTarget?: THREE.Vector3;

    private desiredFacing = -0.55;

    private pointerStart: {
        x: number;
        y: number;
        rotation: number;
        dragging: boolean;
    } | null = null;

    public constructor(
        private readonly container: HTMLElement,
        options: SalemSceneOptions,
    ) {
        this.options = options;
        this.camera = new THREE.PerspectiveCamera(29, 1, 0.1, 80);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });

        this.configureRenderer();
        this.createWorld();
        this.createSalemFallback();
        this.attachEvents();
        this.setWeather('clear');
        this.resize();
        this.animate();
    }

    public forceAction(action: SalemAction): void {
        this.manualMoveTarget = undefined;
        this.currentAction = action;
        this.actionStartedAt = performance.now();
        this.options.onActionChange(action);
    }

    public moveTo(target: [number, number, number]): void {
        this.moveSalemTo(new THREE.Vector3(...target));
    }

    public resetPosition(): void {
        this.catAnchor.position.set(...salemHome.idle);
        this.catAnchor.rotation.set(0, -0.55, 0);
        this.forceAction('idle');
    }

    public setWeather(weather: SalemWeather): void {
        const preset = weatherPresets[weather];
        this.scene.background = new THREE.Color(preset.background);
        this.scene.fog = new THREE.Fog(
            preset.fog,
            preset.fogNear,
            preset.fogFar,
        );

        if (this.hemisphere) {
            this.hemisphere.color.set(preset.hemisphereSky);
            this.hemisphere.groundColor.set(preset.hemisphereGround);
        }

        if (this.sunlight) {
            this.sunlight.color.set(preset.sunlight);
            this.sunlight.intensity = preset.sunlightIntensity;
        }

        this.weatherParticles.forEach((particles) => {
            particles.visible = false;
        });
        this.createWeatherParticles(preset.particleColor, preset.particleCount);

        if (this.laptopGlow) {
            this.laptopGlow.intensity = weather === 'night' ? 1.35 : 0.55;
        }
    }

    public dispose(): void {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
        }

        window.removeEventListener('resize', this.resize);
        this.renderer.domElement.removeEventListener(
            'pointerdown',
            this.onPointerDown,
        );
        this.renderer.domElement.removeEventListener(
            'pointermove',
            this.onPointerMove,
        );
        window.removeEventListener('pointerup', this.onPointerUp);
        this.renderer.domElement.removeEventListener('wheel', this.onWheel);
        this.disposeObject(this.scene);
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    private configureRenderer(): void {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.04;
        this.renderer.domElement.className = 'block size-full';
        this.renderer.domElement.style.cursor = 'grab';
        this.container.appendChild(this.renderer.domElement);
    }

    private createWorld(): void {
        this.root.rotation.y = this.rootRotation;
        this.root.position.y = -0.15;
        this.atmosphere.position.y = -0.1;
        this.scene.add(this.atmosphere);
        this.scene.add(this.root);

        this.hemisphere = new THREE.HemisphereLight('#eefcff', '#83745f', 1.08);
        this.scene.add(this.hemisphere);

        this.sunlight = new THREE.DirectionalLight('#fff2c8', 2.7);
        this.sunlight.position.set(-5, 9, 7);
        this.sunlight.castShadow = true;
        this.sunlight.shadow.mapSize.set(1024, 1024);
        this.sunlight.shadow.camera.left = -7;
        this.sunlight.shadow.camera.right = 7;
        this.sunlight.shadow.camera.top = 6;
        this.sunlight.shadow.camera.bottom = -6;
        this.sunlight.shadow.bias = -0.0004;
        this.sunlight.shadow.normalBias = 0.025;
        this.scene.add(this.sunlight);

        const fillLight = new THREE.DirectionalLight('#a9e8ff', 0.34);
        fillLight.position.set(6, 3, -5);
        this.scene.add(fillLight);

        this.laptopGlow = new THREE.PointLight('#7dd3fc', 0.55, 5);
        this.laptopGlow.position.set(...programmingSpot.laptop);
        this.root.add(this.laptopGlow);

        islandConfigs.forEach((island) =>
            this.root.add(this.createIsland(island)),
        );
        this.createCloudBands();
        this.createProgrammingPaws();
        this.root.add(this.catAnchor);
        this.resetPosition();
    }

    private createIsland(island: IslandConfig): THREE.Group {
        const group = new THREE.Group();
        group.position.set(...island.position);
        this.floatingIslands.push({
            group,
            baseY: island.position[1],
            phase: island.position[0] * 0.47 + island.position[2] * 0.29,
            speed: island.id === 'home' ? 0.24 : 0.18 + island.radius * 0.025,
            amplitude:
                island.id === 'home' ? 0.025 : 0.035 + island.radius * 0.006,
        });

        const islandScale =
            island.id === 'home' ? new THREE.Vector3(1.16, 1, 0.82) : null;
        const scale = islandScale ?? new THREE.Vector3(1, 1, 1);
        const islandSeed = this.seedFromString(island.id);
        const terrain = createSculptedIslandGeometries({
            radius: island.radius,
            height: island.height,
            seed: islandSeed,
            scaleX: scale.x,
            scaleZ: scale.z,
            topColor: island.color,
            soilColor: island.soilColor,
            rootColor: this.rootColorForBiome(island.biome),
        });
        const top = new THREE.Mesh(
            terrain.top,
            new THREE.MeshStandardMaterial({
                color: '#ffffff',
                roughness: 0.86,
                metalness: 0,
                vertexColors: true,
                flatShading: false,
            }),
        );
        top.castShadow = true;
        top.receiveShadow = true;
        this.registerInteraction(top, {
            action: 'walk',
            weather: island.weatherHint,
        });
        group.add(top);

        const cliff = new THREE.Mesh(
            terrain.cliff,
            new THREE.MeshStandardMaterial({
                color: '#ffffff',
                roughness: 0.92,
                metalness: 0,
                vertexColors: true,
                flatShading: true,
            }),
        );
        cliff.castShadow = true;
        cliff.receiveShadow = true;
        group.add(cliff);

        const root = new THREE.Mesh(
            terrain.root,
            new THREE.MeshStandardMaterial({
                color: '#ffffff',
                roughness: 0.94,
                metalness: 0,
                vertexColors: true,
                flatShading: true,
            }),
        );
        root.castShadow = true;
        root.receiveShadow = true;
        group.add(root);

        this.addGrassDetails(group, island, islandScale);

        this.addGroundScatter(group, island, islandScale);

        this.addIslandProps(group, island);

        this.addBiomeFeatures(group, island);

        island.waterfalls?.forEach((waterfall) => {
            const createdWaterfall = this.createWaterfall(
                waterfall.offset,
                waterfall.height,
            );
            this.waterFalls.push(createdWaterfall);
            group.add(createdWaterfall.stream);
            group.add(createdWaterfall.droplets);
        });

        return group;
    }

    private addGrassDetails(
        group: THREE.Group,
        island: IslandConfig,
        islandScale: THREE.Vector3 | null,
    ): void {
        const islandSeed = this.seedFromString(island.id);
        const surfaceY = islandSurfaceY(island.height);
        const highlight = new THREE.Mesh(
            this.createIrregularDiscGeometry(
                island.radius * 0.52,
                24,
                islandSeed + 73,
                0.16,
            ),
            new THREE.MeshStandardMaterial({
                color: this.highlightColorForBiome(island.biome),
                transparent: true,
                opacity: island.id === 'home' ? 0.12 : 0.075,
                roughness: 0.95,
                depthWrite: false,
            }),
        );
        highlight.rotation.x = -Math.PI * 0.5;
        highlight.position.set(-0.38, surfaceY + 0.012, -0.24);
        highlight.scale.copy(islandScale ?? new THREE.Vector3(1, 1, 1));
        group.add(highlight);

        const path = new THREE.Mesh(
            this.createIrregularDiscGeometry(
                island.radius * (island.id === 'home' ? 0.34 : 0.24),
                18,
                islandSeed + 109,
                0.18,
            ),
            new THREE.MeshStandardMaterial({
                color: this.pathColorForBiome(island.biome),
                transparent: true,
                opacity: island.id === 'home' ? 0.16 : 0.055,
                roughness: 0.96,
                depthWrite: false,
            }),
        );
        path.rotation.x = -Math.PI * 0.5;
        path.scale.set(
            islandScale ? islandScale.x * 1.15 : 1.15,
            islandScale ? islandScale.z * 0.58 : 0.58,
            1,
        );
        path.position.set(
            island.id === 'home' ? 0.75 : island.radius * 0.18,
            surfaceY + 0.014,
            island.id === 'home' ? 0.88 : -island.radius * 0.2,
        );
        group.add(path);
    }

    private highlightColorForBiome(biome: IslandBiome): string {
        const colors: Record<IslandBiome, string> = {
            autumn: '#f2a45d',
            crystal: '#a5fff1',
            desert: '#f0bd61',
            home: '#a7df72',
            lavender: '#c9a2ff',
            lunar: '#cdd2e8',
            mangrove: '#69c690',
            meadow: '#a7df72',
            nebula: '#ff9df3',
            rocky: '#bec5b8',
            tropical: '#70e0ad',
            tundra: '#dcf8ff',
        };

        return colors[biome];
    }

    private pathColorForBiome(biome: IslandBiome): string {
        const colors: Record<IslandBiome, string> = {
            autumn: '#d68b4e',
            crystal: '#d4f8ff',
            desert: '#e5b45f',
            home: '#e2bf8f',
            lavender: '#ddc1ff',
            lunar: '#a5aab8',
            mangrove: '#5a8566',
            meadow: '#e2bf8f',
            nebula: '#9a88ff',
            rocky: '#a5aea8',
            tropical: '#76c9b0',
            tundra: '#e3f4ef',
        };

        return colors[biome];
    }

    private rootColorForBiome(biome: IslandBiome): string {
        const colors: Record<IslandBiome, string> = {
            autumn: '#5f4b45',
            crystal: '#4d6068',
            desert: '#685448',
            home: '#5b504c',
            lavender: '#605765',
            lunar: '#52535f',
            mangrove: '#4a5b52',
            meadow: '#5d554d',
            nebula: '#504f68',
            rocky: '#595a60',
            tropical: '#4f6057',
            tundra: '#5d686d',
        };

        return colors[biome];
    }

    private addGroundScatter(
        group: THREE.Group,
        island: IslandConfig,
        islandScale: THREE.Vector3 | null,
    ): void {
        const scale = islandScale ?? new THREE.Vector3(1, 1, 1);
        group.add(this.createGrassScatter(island, scale));
        group.add(this.createPebbleScatter(island, scale));
        group.add(this.createGroundingScatter(island, scale));

        if (island.props.includes('trees')) {
            group.add(this.createSaplingScatter(island, scale));
        }

        if (
            island.props.includes('trees') ||
            island.props.includes('flowers')
        ) {
            group.add(this.createShrubScatter(island, scale));
        }
    }

    private createGrassScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.InstancedMesh {
        const count =
            island.id === 'home' ? 44 : Math.round(12 + island.radius * 7);
        const colors = this.scatterColorsForBiome(island.biome);
        const grass = new THREE.InstancedMesh(
            this.createGrassTuftGeometry(),
            new THREE.MeshStandardMaterial({
                color: colors.grass,
                roughness: 0.7,
                flatShading: true,
                emissive: colors.grass,
                emissiveIntensity: 0.035,
                side: THREE.DoubleSide,
            }),
            count,
        );
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const size = new THREE.Vector3();

        for (let index = 0; index < count; index += 1) {
            position.copy(
                this.scatterPointOnIsland(island, islandScale, index, 31.7),
            );
            position.y += 0.008;
            rotation.set(
                this.randomSigned(index, 3.7) * 0.18,
                this.random(index, 8.9) * Math.PI * 2,
                this.randomSigned(index, 11.2) * 0.14,
            );
            quaternion.setFromEuler(rotation);
            const height = 0.78 + this.random(index, 18.4) * 0.42;
            size.set(
                0.78 + this.random(index, 41.2) * 0.34,
                height,
                0.78 + this.random(index, 51.2) * 0.34,
            );
            matrix.compose(position, quaternion, size);
            grass.setMatrixAt(index, matrix);
        }

        grass.receiveShadow = true;

        return grass;
    }

    private createGrassTuftGeometry(): THREE.BufferGeometry {
        const positions: number[] = [];

        for (let blade = 0; blade < 3; blade += 1) {
            const angle = (blade / 3) * Math.PI;
            const acrossX = Math.cos(angle) * 0.045;
            const acrossZ = Math.sin(angle) * 0.045;
            const leanX = Math.sin(angle) * 0.025;
            const leanZ = Math.cos(angle) * 0.025;

            positions.push(
                -acrossX,
                0,
                -acrossZ,
                acrossX,
                0,
                acrossZ,
                leanX,
                0.2 + blade * 0.018,
                leanZ,
            );
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.computeVertexNormals();

        return geometry;
    }

    private createPebbleScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.InstancedMesh {
        const count =
            island.id === 'home' ? 20 : Math.round(6 + island.radius * 5);
        const colors = this.scatterColorsForBiome(island.biome);
        const pebbles = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.065, 0),
            new THREE.MeshStandardMaterial({
                color: colors.stone,
                roughness: 0.8,
                flatShading: true,
            }),
            count,
        );
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const size = new THREE.Vector3();

        for (let index = 0; index < count; index += 1) {
            position.copy(
                this.scatterPointOnIsland(island, islandScale, index, 73.1),
            );
            position.y += 0.015;
            rotation.set(
                this.random(index, 2.1) * Math.PI,
                this.random(index, 5.2) * Math.PI,
                this.random(index, 7.6) * Math.PI,
            );
            quaternion.setFromEuler(rotation);
            const pebbleSize = 0.45 + this.random(index, 13.8) * 0.82;
            size.set(
                pebbleSize * (0.8 + this.random(index, 22.1) * 0.75),
                pebbleSize * (0.28 + this.random(index, 28.6) * 0.28),
                pebbleSize * (0.78 + this.random(index, 35.4) * 0.55),
            );
            matrix.compose(position, quaternion, size);
            pebbles.setMatrixAt(index, matrix);
        }

        pebbles.castShadow = true;
        pebbles.receiveShadow = true;

        return pebbles;
    }

    private createGroundingScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.Group {
        const group = new THREE.Group();
        const anchors =
            island.assetPlacements?.filter((placement) =>
                ['trees', 'rocks', 'decor', 'stumps'].includes(placement.role),
            ) ?? [];

        if (anchors.length === 0) {
            return group;
        }

        const surfaceY = islandSurfaceY(island.height);
        const moundColor = new THREE.Color(island.color).lerp(
            new THREE.Color(island.soilColor),
            0.18,
        );
        const colors = this.scatterColorsForBiome(island.biome);
        const mounds = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.14, 0),
            new THREE.MeshStandardMaterial({
                color: moundColor,
                roughness: 0.94,
                flatShading: true,
            }),
            anchors.length,
        );
        const chips = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.075, 0),
            new THREE.MeshStandardMaterial({
                color: colors.stone,
                roughness: 0.94,
                flatShading: true,
            }),
            anchors.length,
        );
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = new THREE.Vector3();
        const size = new THREE.Vector3();

        anchors.forEach((anchor, index) => {
            const importance = anchor.role === 'trees' ? 1.25 : 0.9;
            position.set(
                anchor.position[0],
                surfaceY - 0.025,
                anchor.position[2],
            );
            size.set(importance * 1.5, 0.26, importance * 1.18);
            matrix.compose(position, quaternion, size);
            mounds.setMatrixAt(index, matrix);

            const angle = this.random(index, 221.7) * Math.PI * 2;
            const distance = 0.15 + this.random(index, 236.4) * 0.13;
            position.set(
                anchor.position[0] + Math.cos(angle) * distance * islandScale.x,
                surfaceY - 0.015,
                anchor.position[2] + Math.sin(angle) * distance * islandScale.z,
            );
            quaternion.setFromEuler(
                new THREE.Euler(
                    this.random(index, 247.1) * Math.PI,
                    this.random(index, 251.9) * Math.PI,
                    this.random(index, 263.5) * Math.PI,
                ),
            );
            const chipSize = 0.55 + this.random(index, 271.3) * 0.65;
            size.set(chipSize, chipSize * 0.42, chipSize * 0.8);
            matrix.compose(position, quaternion, size);
            chips.setMatrixAt(index, matrix);
        });

        mounds.receiveShadow = true;
        chips.castShadow = true;
        chips.receiveShadow = true;
        group.add(mounds);
        group.add(chips);

        return group;
    }

    private createShrubScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.Group {
        const group = new THREE.Group();
        const count = island.id === 'home' ? 10 : 4;
        const colors = this.scatterColorsForBiome(island.biome);
        const mainColor = new THREE.Color(colors.tree).lerp(
            new THREE.Color(colors.grass),
            0.3,
        );
        const mainLobes = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.13, 0),
            new THREE.MeshStandardMaterial({
                color: mainColor,
                roughness: 0.82,
                flatShading: true,
            }),
            count,
        );
        const accentLobes = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.1, 0),
            new THREE.MeshStandardMaterial({
                color: colors.treeAccent,
                roughness: 0.84,
                flatShading: true,
            }),
            count,
        );
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = new THREE.Vector3();
        const size = new THREE.Vector3();

        for (let index = 0; index < count; index += 1) {
            const base = this.scatterPointOnIsland(
                island,
                islandScale,
                index,
                207.3,
            );
            const angle = this.random(index, 284.9) * Math.PI * 2;
            const shrubSize = 0.8 + this.random(index, 292.6) * 0.45;
            quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
            position.copy(base);
            position.y += 0.08;
            size.set(shrubSize * 1.2, shrubSize * 0.72, shrubSize);
            matrix.compose(position, quaternion, size);
            mainLobes.setMatrixAt(index, matrix);

            position.x += Math.cos(angle) * 0.1 * shrubSize;
            position.y += 0.07 * shrubSize;
            position.z += Math.sin(angle) * 0.1 * shrubSize;
            size.set(shrubSize * 0.82, shrubSize * 0.66, shrubSize * 0.78);
            matrix.compose(position, quaternion, size);
            accentLobes.setMatrixAt(index, matrix);
        }

        mainLobes.castShadow = true;
        mainLobes.receiveShadow = true;
        accentLobes.castShadow = true;
        group.add(mainLobes);
        group.add(accentLobes);

        return group;
    }

    private createSaplingScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.Group {
        const group = new THREE.Group();
        const count =
            island.id === 'home'
                ? 4
                : Math.max(1, Math.round(island.radius * 0.85));
        const colors = this.scatterColorsForBiome(island.biome);
        const trunks = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.026, 0.05, 0.46, 5),
            new THREE.MeshStandardMaterial({
                color: '#6b4935',
                roughness: 0.86,
                flatShading: true,
            }),
            count,
        );
        const baseMounds = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.11, 0),
            new THREE.MeshStandardMaterial({
                color: colors.grass,
                roughness: 0.9,
                flatShading: true,
            }),
            count,
        );
        const mainCanopies = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.21, 0),
            new THREE.MeshStandardMaterial({
                color: colors.tree,
                roughness: 0.82,
                flatShading: true,
            }),
            count,
        );
        const sideCanopies = new THREE.InstancedMesh(
            new THREE.DodecahedronGeometry(0.17, 0),
            new THREE.MeshStandardMaterial({
                color: colors.treeAccent,
                roughness: 0.84,
                flatShading: true,
            }),
            count,
        );
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const size = new THREE.Vector3();

        for (let index = 0; index < count; index += 1) {
            const base = this.scatterPointOnIsland(
                island,
                islandScale,
                index,
                129.3,
            );
            const angle = this.random(index, 9.4) * Math.PI * 2;
            rotation.set(
                this.randomSigned(index, 14.2) * 0.035,
                angle,
                this.randomSigned(index, 21.7) * 0.035,
            );
            quaternion.setFromEuler(rotation);
            const treeSize =
                island.id === 'home'
                    ? 0.86 + this.random(index, 44.5) * 0.28
                    : 0.78 + this.random(index, 44.5) * 0.24;

            position.copy(base);
            position.y -= 0.02;
            size.set(treeSize * 1.35, treeSize * 0.24, treeSize * 1.1);
            matrix.compose(position, quaternion, size);
            baseMounds.setMatrixAt(index, matrix);

            position.copy(base);
            position.y += 0.22 * treeSize;
            size.setScalar(treeSize);
            matrix.compose(position, quaternion, size);
            trunks.setMatrixAt(index, matrix);

            position.copy(base);
            position.y += 0.52 * treeSize;
            size.set(
                treeSize * (0.82 + this.random(index, 18.9) * 0.12),
                treeSize * (1.12 + this.random(index, 24.3) * 0.16),
                treeSize * (0.75 + this.random(index, 36.1) * 0.12),
            );
            matrix.compose(position, quaternion, size);
            mainCanopies.setMatrixAt(index, matrix);

            position.x += Math.cos(angle) * 0.14 * treeSize;
            position.y += 0.04 * treeSize;
            position.z += Math.sin(angle) * 0.14 * treeSize;
            size.set(treeSize * 0.72, treeSize * 0.82, treeSize * 0.68);
            matrix.compose(position, quaternion, size);
            sideCanopies.setMatrixAt(index, matrix);
        }

        trunks.castShadow = true;
        baseMounds.receiveShadow = true;
        mainCanopies.castShadow = true;
        mainCanopies.receiveShadow = true;
        sideCanopies.castShadow = true;
        group.add(trunks);
        group.add(baseMounds);
        group.add(mainCanopies);
        group.add(sideCanopies);

        return group;
    }

    private scatterPointOnIsland(
        island: IslandConfig,
        islandScale: THREE.Vector3,
        index: number,
        seed: number,
    ): THREE.Vector3 {
        const islandSeed = (this.seedFromString(island.id) % 10000) / 101;
        const clusterCount = island.id === 'home' ? 5 : 3;
        let point = new THREE.Vector3();

        for (let attempt = 0; attempt < 10; attempt += 1) {
            const cursor = index + attempt * 23;
            const cluster = Math.floor(
                this.random(cursor, seed + islandSeed) * clusterCount,
            );
            const centerAngle =
                (cluster / clusterCount) * Math.PI * 2 +
                this.random(cluster, seed + islandSeed + 4.7) * 1.15;
            const centerDistance =
                island.radius *
                (0.22 + this.random(cluster, seed + islandSeed + 11.3) * 0.42);
            const spread =
                island.radius *
                (0.06 + this.random(cluster, seed + islandSeed + 18.1) * 0.12);
            const jitterAngle =
                this.random(cursor, seed + islandSeed + 27.9) * Math.PI * 2;
            const jitterDistance =
                spread *
                Math.sqrt(this.random(cursor, seed + islandSeed + 35.6));
            let x =
                Math.cos(centerAngle) * centerDistance +
                Math.cos(jitterAngle) * jitterDistance;
            let z =
                Math.sin(centerAngle) * centerDistance +
                Math.sin(jitterAngle) * jitterDistance;
            const distance = Math.hypot(x, z);
            const maximumDistance = island.radius * 0.82;

            if (distance > maximumDistance) {
                const clamp = maximumDistance / distance;
                x *= clamp;
                z *= clamp;
            }

            point = new THREE.Vector3(
                x * islandScale.x,
                islandSurfaceY(island.height) + 0.012,
                z * islandScale.z,
            );

            if (!this.isProtectedScatterPoint(island, point)) {
                return point;
            }
        }

        return point;
    }

    private isProtectedScatterPoint(
        island: IslandConfig,
        point: THREE.Vector3,
    ): boolean {
        if (island.id !== 'home') {
            return false;
        }

        const protectedZones = [
            { x: -0.95, z: -0.88, radius: 1.05 },
            { x: 1.92, z: 1.2, radius: 0.78 },
            {
                x: programmingSpot.laptop[0],
                z: programmingSpot.laptop[2],
                radius: 0.72,
            },
            { x: salemHome.idle[0], z: salemHome.idle[2], radius: 0.48 },
        ];

        return protectedZones.some((zone) => {
            const x = point.x - zone.x;
            const z = point.z - zone.z;

            return Math.hypot(x, z) < zone.radius;
        });
    }

    private scatterColorsForBiome(biome: IslandBiome): {
        grass: string;
        grassAccent: string;
        stone: string;
        stoneAccent: string;
        tree: string;
        treeAccent: string;
    } {
        const colors: Record<
            IslandBiome,
            {
                grass: string;
                grassAccent: string;
                stone: string;
                stoneAccent: string;
                tree: string;
                treeAccent: string;
            }
        > = {
            autumn: {
                grass: '#c58a45',
                grassAccent: '#d6a65d',
                stone: '#73695e',
                stoneAccent: '#9a8b73',
                tree: '#a9553b',
                treeAccent: '#d18b42',
            },
            crystal: {
                grass: '#6fd1c9',
                grassAccent: '#9df9f2',
                stone: '#648a9a',
                stoneAccent: '#b4f3ff',
                tree: '#74d7dd',
                treeAccent: '#b492ff',
            },
            desert: {
                grass: '#c89446',
                grassAccent: '#e5bd68',
                stone: '#8b684e',
                stoneAccent: '#b68b62',
                tree: '#b8843d',
                treeAccent: '#dfae56',
            },
            home: {
                grass: '#4f9a5b',
                grassAccent: '#8bcf68',
                stone: '#747c74',
                stoneAccent: '#a0a28f',
                tree: '#2f7d54',
                treeAccent: '#69a85d',
            },
            lavender: {
                grass: '#879e62',
                grassAccent: '#bfa0ee',
                stone: '#756b7f',
                stoneAccent: '#a594b7',
                tree: '#758855',
                treeAccent: '#a98bdd',
            },
            lunar: {
                grass: '#7f8792',
                grassAccent: '#c7cedd',
                stone: '#5e6470',
                stoneAccent: '#969dab',
                tree: '#7b8498',
                treeAccent: '#c7ccd9',
            },
            mangrove: {
                grass: '#34795f',
                grassAccent: '#60b17a',
                stone: '#56665b',
                stoneAccent: '#8b9a7d',
                tree: '#236b54',
                treeAccent: '#4b9b66',
            },
            meadow: {
                grass: '#5ca65a',
                grassAccent: '#a2d66b',
                stone: '#7b8175',
                stoneAccent: '#a6aa91',
                tree: '#3f9a55',
                treeAccent: '#88c95f',
            },
            nebula: {
                grass: '#6575d6',
                grassAccent: '#df85ff',
                stone: '#505583',
                stoneAccent: '#9aa2ee',
                tree: '#5f7cff',
                treeAccent: '#d66bf0',
            },
            rocky: {
                grass: '#7b8879',
                grassAccent: '#a8b99b',
                stone: '#667077',
                stoneAccent: '#9aa1a0',
                tree: '#718078',
                treeAccent: '#a1aa91',
            },
            tropical: {
                grass: '#238f6f',
                grassAccent: '#66cf93',
                stone: '#5d746b',
                stoneAccent: '#8d9b86',
                tree: '#1d9073',
                treeAccent: '#54c28b',
            },
            tundra: {
                grass: '#93b8aa',
                grassAccent: '#d7f5ec',
                stone: '#738089',
                stoneAccent: '#b9c5c8',
                tree: '#7aa294',
                treeAccent: '#d9f6ee',
            },
        };

        return colors[biome];
    }

    private random(index: number, seed: number): number {
        return (
            Math.abs(Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453) % 1
        );
    }

    private randomSigned(index: number, seed: number): number {
        return this.random(index, seed) * 2 - 1;
    }

    private seedFromString(value: string): number {
        let hash = 2166136261;

        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
    }

    private createIrregularDiscGeometry(
        radius: number,
        segments: number,
        seed: number,
        strength: number,
    ): THREE.CircleGeometry {
        const geometry = new THREE.CircleGeometry(radius, segments);
        const positions = geometry.getAttribute('position');

        for (let index = 0; index < positions.count; index += 1) {
            const x = positions.getX(index);
            const y = positions.getY(index);

            if (Math.hypot(x, y) < 0.0001) {
                continue;
            }

            const angle = Math.atan2(y, x);
            const radialScale =
                1 + this.radialShapeNoise(angle, seed) * strength;
            positions.setXY(index, x * radialScale, y * radialScale);
        }

        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        return geometry;
    }

    private radialShapeNoise(angle: number, seed: number): number {
        const phase = (seed % 997) * 0.017;

        return (
            Math.sin(angle * 3 + phase) * 0.48 +
            Math.sin(angle * 5 - phase * 0.73) * 0.32 +
            Math.sin(angle * 7 + phase * 1.31) * 0.2
        );
    }

    private addIslandProps(group: THREE.Group, island: IslandConfig): void {
        if (island.props.includes('cabin')) {
            this.addAssetRole(group, island, 'cabin', this.createCabin());
        }

        if (island.props.includes('chair')) {
            this.addAssetRole(group, island, 'chair', this.createChair());
        }

        if (island.props.includes('laptop')) {
            group.add(this.createLaptop());
        }

        if (island.props.includes('trees')) {
            this.addAssetRole(
                group,
                island,
                'trees',
                this.createTrees(
                    island.biome,
                    island.radius,
                    islandSurfaceY(island.height),
                ),
            );
        }

        if (island.props.includes('flowers')) {
            this.addAssetRole(
                group,
                island,
                'flowers',
                this.createFlowers(island),
            );
        }

        if (island.props.includes('rocks')) {
            this.addAssetRole(group, island, 'rocks', this.createRocks(island));
        }

        if (island.props.includes('pool')) {
            this.addPool(group, island);
        }

        if (island.props.includes('lantern')) {
            group.add(
                this.createLantern(island.biome, islandSurfaceY(island.height)),
            );
        }

        if (island.props.includes('stumps')) {
            this.addAssetRole(
                group,
                island,
                'stumps',
                this.createStump(islandSurfaceY(island.height)),
            );
        }

        this.addAssetRole(group, island, 'decor');
    }

    private addBiomeFeatures(group: THREE.Group, island: IslandConfig): void {
        if (island.biome === 'crystal') {
            group.add(
                this.createCrystalCluster([
                    [-0.35, 0.52, -0.35],
                    [0.15, 0.52, 0.15],
                    [0.48, 0.52, -0.25],
                ]),
            );
        }

        if (island.biome === 'lunar') {
            group.add(this.createLunarRing(island.radius));
        }

        if (island.biome === 'nebula') {
            group.add(this.createNebulaBeacon(island.radius));
        }

        if (island.biome === 'desert') {
            group.add(this.createDuneNeedles());
        }

        if (island.biome === 'mangrove') {
            group.add(this.createMangroveRoots());
        }

        if (island.biome === 'lavender') {
            group.add(this.createLavenderWisps(island.radius));
        }

        if (island.biome === 'tundra') {
            group.add(this.createFrostCrystals());
        }
    }

    private createCrystalCluster(
        positions: [number, number, number][],
    ): THREE.Group {
        const group = new THREE.Group();
        const colors = ['#8ff8ff', '#bda7ff', '#70f0ca'];

        positions.forEach((position, index) => {
            const crystal = new THREE.Mesh(
                new THREE.ConeGeometry(0.13 + index * 0.035, 0.72, 5),
                new THREE.MeshStandardMaterial({
                    color: colors[index % colors.length],
                    emissive: colors[index % colors.length],
                    emissiveIntensity: 0.25,
                    roughness: 0.38,
                    flatShading: true,
                }),
            );
            crystal.position.set(...position);
            crystal.rotation.set(0.2, index * 0.8, -0.12);
            crystal.castShadow = true;
            group.add(crystal);
            this.animatedFeatures.push({
                object: crystal,
                baseY: position[1],
                phase: index * 0.9,
                spin: 0.08,
                bob: 0.035,
            });
        });

        return group;
    }

    private createLunarRing(radius: number): THREE.Group {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 0.48, 0.018, 6, 56),
            new THREE.MeshBasicMaterial({
                color: '#dbe7ff',
                transparent: true,
                opacity: 0.72,
            }),
        );
        ring.position.y = 0.82;
        ring.rotation.x = Math.PI * 0.5;
        group.add(ring);
        this.animatedFeatures.push({
            object: ring,
            baseY: ring.position.y,
            phase: 1.4,
            spin: 0.18,
            bob: 0.025,
        });

        return group;
    }

    private createNebulaBeacon(radius: number): THREE.Group {
        const group = new THREE.Group();
        const core = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.22, 0),
            new THREE.MeshStandardMaterial({
                color: '#ff8ff4',
                emissive: '#8957ff',
                emissiveIntensity: 0.8,
                roughness: 0.45,
                flatShading: true,
            }),
        );
        core.position.set(0.2, 0.92, -0.05);
        group.add(core);

        const orbit = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 0.34, 0.011, 5, 44),
            new THREE.MeshBasicMaterial({
                color: '#88f7ff',
                transparent: true,
                opacity: 0.58,
            }),
        );
        orbit.position.copy(core.position);
        orbit.rotation.set(1.2, 0.45, 0.3);
        group.add(orbit);

        [core, orbit].forEach((object, index) =>
            this.animatedFeatures.push({
                object,
                baseY: object.position.y,
                phase: index * 1.2,
                spin: index === 0 ? 0.35 : -0.22,
                bob: 0.045,
            }),
        );

        return group;
    }

    private createDuneNeedles(): THREE.Group {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
            color: '#d9a046',
            roughness: 0.86,
            flatShading: true,
        });

        for (let index = 0; index < 5; index += 1) {
            const needle = new THREE.Mesh(
                new THREE.ConeGeometry(0.05, 0.45 + index * 0.03, 4),
                material,
            );
            needle.position.set(
                Math.sin(index * 1.8) * 0.78,
                0.56,
                Math.cos(index * 1.4) * 0.54,
            );
            needle.rotation.y = index * 0.7;
            group.add(needle);
        }

        return group;
    }

    private createMangroveRoots(): THREE.Group {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({
            color: '#65412d',
            roughness: 0.92,
            flatShading: true,
        });

        for (let index = 0; index < 7; index += 1) {
            const root = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.04, 0.72, 5),
                material,
            );
            root.position.set(
                Math.sin(index * 1.1) * 0.54,
                0.55,
                Math.cos(index * 1.37) * 0.62,
            );
            root.rotation.set(0.45, index * 0.5, 0.22);
            root.castShadow = true;
            group.add(root);
        }

        return group;
    }

    private createLavenderWisps(radius: number): THREE.Group {
        const group = new THREE.Group();
        const material = new THREE.MeshBasicMaterial({
            color: '#c9a2ff',
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
        });

        for (let index = 0; index < 8; index += 1) {
            const wisp = new THREE.Mesh(
                new THREE.SphereGeometry(0.035, 8, 6),
                material,
            );
            const angle = index * 1.37;
            wisp.position.set(
                Math.cos(angle) * radius * 0.42,
                0.78 + (index % 3) * 0.08,
                Math.sin(angle) * radius * 0.42,
            );
            group.add(wisp);
            this.animatedFeatures.push({
                object: wisp,
                baseY: wisp.position.y,
                phase: index * 0.65,
                spin: 0,
                bob: 0.08,
            });
        }

        return group;
    }

    private createFrostCrystals(): THREE.Group {
        return this.createCrystalCluster([
            [-0.65, 0.56, 0.25],
            [0.24, 0.56, -0.52],
            [0.58, 0.56, 0.12],
        ]);
    }

    private addAssetRole(
        group: THREE.Group,
        island: IslandConfig,
        role: IslandAssetRole,
        fallback?: THREE.Group,
    ): void {
        if (!this.shouldUseDetailedAssets(island)) {
            if (fallback) {
                group.add(fallback);
            }

            return;
        }

        const placements = island.assetPlacements?.filter(
            (placement) => placement.role === role,
        );

        if (!placements?.length) {
            if (fallback) {
                group.add(fallback);
            }

            return;
        }

        if (fallback) {
            group.add(fallback);
        }

        void this.loadAssetPlacements(placements).then((assets) => {
            if (assets.length === 0) {
                return;
            }

            if (fallback) {
                group.remove(fallback);
                this.disposeObject(fallback);
            }

            assets.forEach((asset) => group.add(asset));
        });
    }

    private shouldUseDetailedAssets(island: IslandConfig): boolean {
        return ['home', 'meadow', 'rocky', 'tropical', 'autumn'].includes(
            island.id,
        );
    }

    private async loadAssetPlacements(
        placements: IslandAssetPlacement[],
    ): Promise<THREE.Group[]> {
        const loaded = await Promise.allSettled(
            placements.map((placement) =>
                this.assetLoader.createStaticInstance(placement.asset, {
                    position: placement.position,
                    rotation: placement.rotation,
                    scale: placement.scale,
                }),
            ),
        );

        const assets = loaded.flatMap((result) =>
            result.status === 'fulfilled' ? [result.value] : [],
        );

        if (assets.length !== placements.length) {
            this.options.onAssetError(
                'Some Salem scenery models could not load, using fallbacks.',
            );
        }

        return assets;
    }

    private disposeObject(object: THREE.Object3D): void {
        object.traverse((child) => {
            const mesh = child as THREE.Mesh;

            if (mesh.geometry) {
                mesh.geometry.dispose();
            }

            const material = mesh.material;

            if (Array.isArray(material)) {
                material.forEach((item) => item.dispose());

                return;
            }

            material?.dispose();
        });
    }

    private createCabin(): THREE.Group {
        const group = new THREE.Group();
        group.position.set(-0.95, 0.86, -0.92);
        group.rotation.y = -0.42;

        const wallMaterial = new THREE.MeshStandardMaterial({
            color: '#9f663d',
            roughness: 0.86,
            flatShading: true,
        });
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: '#5a382b',
            roughness: 0.84,
            flatShading: true,
        });

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.1, 0.78, 0.92),
            wallMaterial,
        );
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const sideShade = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.76, 0.88),
            new THREE.MeshStandardMaterial({
                color: '#7c472f',
                roughness: 0.88,
                flatShading: true,
            }),
        );
        sideShade.position.set(0.56, -0.01, -0.01);
        group.add(sideShade);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(0.86, 0.5, 4),
            new THREE.MeshStandardMaterial({
                color: '#57303b',
                roughness: 0.72,
                flatShading: true,
            }),
        );
        roof.position.y = 0.62;
        roof.rotation.y = Math.PI * 0.25;
        roof.castShadow = true;
        group.add(roof);

        const porch = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.07, 0.28),
            trimMaterial,
        );
        porch.position.set(0, -0.43, 0.58);
        porch.castShadow = true;
        group.add(porch);

        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.48, 0.04),
            trimMaterial,
        );
        door.position.set(-0.1, -0.16, 0.48);
        group.add(door);

        const windowMaterial = new THREE.MeshStandardMaterial({
            color: '#ffe7a3',
            emissive: '#ffb84a',
            emissiveIntensity: 0.9,
            roughness: 0.35,
        });
        const window = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 0.045),
            windowMaterial,
        );
        window.position.set(0.28, 0.04, 0.48);
        group.add(window);

        return group;
    }

    private createChair(): THREE.Group {
        const group = new THREE.Group();
        group.position.set(1.72, 0.81, 1.34);
        group.rotation.y = -0.72;

        const wood = new THREE.MeshStandardMaterial({
            color: '#79513a',
            roughness: 0.78,
            flatShading: true,
        });
        const cushion = new THREE.MeshStandardMaterial({
            color: '#263446',
            roughness: 0.64,
            flatShading: true,
        });
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.1, 0.46),
            cushion,
        );
        seat.castShadow = true;
        group.add(seat);

        const back = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.08),
            wood,
        );
        back.position.set(0, 0.26, -0.22);
        back.rotation.x = -0.12;
        back.castShadow = true;
        group.add(back);

        for (const x of [-0.22, 0.22]) {
            for (const z of [-0.2, 0.2]) {
                const leg = new THREE.Mesh(
                    new THREE.BoxGeometry(0.055, 0.34, 0.055),
                    wood,
                );
                leg.position.set(x * 0.86, -0.22, z * 0.82);
                leg.castShadow = true;
                group.add(leg);
            }
        }

        return group;
    }

    private createLaptop(): THREE.Group {
        const group = new THREE.Group();
        group.position.set(...programmingSpot.laptop);
        group.rotation.set(-0.08, -0.72, 0);

        const shell = new THREE.MeshStandardMaterial({
            color: '#172033',
            metalness: 0.2,
            roughness: 0.45,
            flatShading: true,
        });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.055, 0.38),
            shell,
        );
        this.registerInteraction(base, {
            action: 'program',
            target: new THREE.Vector3(...programmingSpot.seat),
            weather: 'night',
        });
        group.add(base);

        this.laptopScreen = new THREE.MeshStandardMaterial({
            color: '#101827',
            emissive: '#37d5ff',
            emissiveIntensity: 0.72,
            roughness: 0.35,
        });

        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.38, 0.045),
            this.laptopScreen,
        );
        screen.position.set(0, 0.22, -0.16);
        screen.rotation.x = -0.34;
        this.registerInteraction(screen, {
            action: 'program',
            target: new THREE.Vector3(...programmingSpot.seat),
            weather: 'night',
        });
        group.add(screen);

        const lineMaterial = new THREE.MeshBasicMaterial({ color: '#b8f7ff' });

        for (let index = 0; index < 5; index += 1) {
            const line = new THREE.Mesh(
                new THREE.BoxGeometry(0.28 - index * 0.026, 0.012, 0.01),
                lineMaterial.clone(),
            );
            line.position.set(-0.04, 0.18 + index * 0.04, -0.194);
            line.rotation.x = -0.34;
            this.laptopCodeLines.push(line);
            group.add(line);
        }

        const target = new THREE.Mesh(
            new THREE.BoxGeometry(1.35, 1.05, 1.05),
            new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                depthWrite: false,
            }),
        );
        target.position.set(0, 0.22, -0.02);
        this.registerInteraction(target, {
            action: 'program',
            target: new THREE.Vector3(...programmingSpot.seat),
            weather: 'night',
        });
        group.add(target);

        return group;
    }

    private createTrees(
        biome: IslandBiome,
        radius: number,
        surfaceY: number,
    ): THREE.Group {
        const group = new THREE.Group();
        const leafColors: Record<IslandBiome, string[]> = {
            autumn: ['#b95d45', '#d8a44e'],
            crystal: ['#69e9ff', '#a78bfa'],
            desert: ['#c08337', '#e0b45e'],
            home: ['#2f7d54', '#68a85a'],
            lavender: ['#7e8f5a', '#a98bdd'],
            lunar: ['#8790a3', '#c7ccd9'],
            mangrove: ['#236b54', '#4b9b66'],
            meadow: ['#3f9a55', '#88c95f'],
            nebula: ['#5f7cff', '#d66bf0'],
            rocky: ['#718078', '#a1aa91'],
            tropical: ['#1d9073', '#54c28b'],
            tundra: ['#7aa294', '#d9f6ee'],
        };
        const positions: [number, number][] = [
            [-radius * 0.56, -radius * 0.08],
            [-radius * 0.42, radius * 0.43],
            [radius * 0.4, -radius * 0.46],
        ];

        positions.forEach((position, index) => {
            const tree = new THREE.Group();
            tree.position.set(position[0], surfaceY - 0.035, position[1]);
            tree.scale.setScalar(
                (index === 1 ? 0.72 : 0.82) + this.random(index, 84.2) * 0.16,
            );
            tree.rotation.y = this.randomSigned(index, 91.7) * 0.32;

            const collar = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.14, 0),
                new THREE.MeshStandardMaterial({
                    color: leafColors[biome][0],
                    roughness: 0.9,
                    flatShading: true,
                }),
            );
            collar.scale.set(1.45, 0.26, 1.15);
            collar.position.y = 0.015;
            collar.receiveShadow = true;
            tree.add(collar);

            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.12, 0.72, 6),
                new THREE.MeshStandardMaterial({
                    color: '#75513a',
                    roughness: 0.9,
                }),
            );
            trunk.position.y = 0.36;
            trunk.castShadow = true;
            tree.add(trunk);

            const leaves = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.4, 0),
                new THREE.MeshStandardMaterial({
                    color: leafColors[biome][index % 2],
                    roughness: 0.8,
                    flatShading: true,
                }),
            );
            leaves.position.y = 1.03;
            leaves.scale.set(0.82, 1.18, 0.86);
            leaves.castShadow = true;
            tree.add(leaves);

            const lowerLeaves = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.44, 0),
                new THREE.MeshStandardMaterial({
                    color: leafColors[biome][(index + 1) % 2],
                    roughness: 0.82,
                    flatShading: true,
                }),
            );
            lowerLeaves.position.set(0.08, 0.82, 0.02);
            lowerLeaves.scale.set(1.08, 0.76, 1);
            lowerLeaves.castShadow = true;
            tree.add(lowerLeaves);

            const sideLeaves = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.31, 0),
                new THREE.MeshStandardMaterial({
                    color: leafColors[biome][index % 2],
                    roughness: 0.84,
                    flatShading: true,
                }),
            );
            sideLeaves.position.set(-0.22, 0.96, 0.05);
            sideLeaves.scale.set(0.86, 0.72, 0.9);
            sideLeaves.castShadow = true;
            tree.add(sideLeaves);
            group.add(tree);
        });

        return group;
    }

    private createFlowers(island: IslandConfig): THREE.Group {
        const group = new THREE.Group();
        const colors = ['#f8c8dc', '#ffe28a', '#c7f9ff'];
        const clusterCount = 3;
        const surfaceY = islandSurfaceY(island.height);

        for (let index = 0; index < 11; index += 1) {
            const cluster = index % clusterCount;
            const centerAngle =
                (cluster / clusterCount) * Math.PI * 2 +
                this.random(cluster, 142.3) * 0.8;
            const centerDistance =
                island.radius * (0.24 + this.random(cluster, 151.8) * 0.34);
            const jitterAngle = this.random(index, 163.4) * Math.PI * 2;
            const jitterDistance =
                island.radius * (0.025 + this.random(index, 171.2) * 0.075);
            const flower = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.055, 0),
                new THREE.MeshStandardMaterial({
                    color: colors[index % colors.length],
                }),
            );
            flower.position.set(
                Math.cos(centerAngle) * centerDistance +
                    Math.cos(jitterAngle) * jitterDistance,
                surfaceY + 0.035,
                Math.sin(centerAngle) * centerDistance +
                    Math.sin(jitterAngle) * jitterDistance,
            );
            flower.scale.setScalar(0.94 + this.random(index, 180.6) * 0.12);
            flower.castShadow = true;
            group.add(flower);
        }

        return group;
    }

    private createRocks(island: IslandConfig): THREE.Group {
        const group = new THREE.Group();
        const surfaceY = islandSurfaceY(island.height);
        const centers = [
            {
                x: -island.radius * 0.35,
                z: island.radius * 0.2,
            },
            {
                x: island.radius * 0.34,
                z: -island.radius * 0.28,
            },
        ];

        for (let index = 0; index < 6; index += 1) {
            const center = centers[index % centers.length];
            const angle = this.random(index, 311.2) * Math.PI * 2;
            const distance =
                island.radius * (0.035 + this.random(index, 326.5) * 0.1);
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.16 + (index % 3) * 0.05, 0),
                new THREE.MeshStandardMaterial({
                    color: index % 2 === 0 ? '#7a8084' : '#9aa0a0',
                    roughness: 0.95,
                    flatShading: true,
                }),
            );
            rock.position.set(
                center.x + Math.cos(angle) * distance,
                surfaceY - 0.045,
                center.z + Math.sin(angle) * distance,
            );
            rock.scale.set(
                0.82 + this.random(index, 335.8) * 0.65,
                0.48 + this.random(index, 341.3) * 0.34,
                0.78 + this.random(index, 352.7) * 0.52,
            );
            rock.rotation.set(
                this.randomSigned(index, 361.2) * 0.3,
                this.random(index, 372.4) * Math.PI,
                this.randomSigned(index, 381.9) * 0.2,
            );
            rock.castShadow = true;
            rock.receiveShadow = true;
            group.add(rock);
        }

        return group;
    }

    private addPool(group: THREE.Group, island: IslandConfig): void {
        const pool = new THREE.Mesh(
            new THREE.CylinderGeometry(0.62, 0.62, 0.035, 20),
            new THREE.MeshStandardMaterial({
                color: '#35bdd3',
                emissive: '#0ea5b7',
                emissiveIntensity: 0.12,
                transparent: true,
                opacity: 0.86,
                roughness: 0.18,
            }),
        );
        pool.position.set(-0.35, islandSurfaceY(island.height) + 0.006, 0.25);
        group.add(pool);
    }

    private createLantern(biome: IslandBiome, surfaceY: number): THREE.Group {
        const group = new THREE.Group();
        group.position.set(
            biome === 'home' ? 0.55 : -0.4,
            surfaceY + 0.43,
            biome === 'home' ? 1.4 : 0.25,
        );

        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.045, 0.86, 6),
            new THREE.MeshStandardMaterial({
                color: '#40302c',
                roughness: 0.7,
            }),
        );
        post.castShadow = true;
        group.add(post);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 12, 8),
            new THREE.MeshStandardMaterial({
                color: '#ffd98f',
                emissive: '#ffb84a',
                emissiveIntensity: 1.8,
            }),
        );
        glow.position.y = 0.5;
        group.add(glow);
        const light = new THREE.PointLight('#ffca7a', 0.85, 4.2);
        light.position.y = 0.5;
        group.add(light);

        return group;
    }

    private createStump(surfaceY: number): THREE.Group {
        const stump = new THREE.Group();
        stump.position.set(-0.2, surfaceY + 0.12, 0.6);
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.26, 0.32, 8),
            new THREE.MeshStandardMaterial({
                color: '#7a5135',
                roughness: 0.85,
            }),
        );
        stump.add(base);

        return stump;
    }

    private createWaterfall(
        offset: [number, number, number],
        height: number,
    ): Waterfall {
        const streamMaterial = new THREE.MeshStandardMaterial({
            color: '#77d9f2',
            transparent: true,
            opacity: 0.56,
            roughness: 0.28,
            emissive: '#2ea7c8',
            emissiveIntensity: 0.08,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const streamGeometry = new THREE.PlaneGeometry(0.34, height, 3, 12);
        const positions = streamGeometry.getAttribute('position');

        for (let index = 0; index < positions.count; index += 1) {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const progress = THREE.MathUtils.clamp(y / height + 0.5, 0, 1);
            const taper = 0.74 + progress * 0.26;
            const wave = Math.sin(progress * Math.PI * 4.2) * 0.018;
            positions.setXYZ(
                index,
                x * taper + wave,
                y,
                Math.sin(progress * Math.PI * 3.1) * 0.022,
            );
        }

        positions.needsUpdate = true;
        streamGeometry.computeVertexNormals();
        const stream = new THREE.Mesh(streamGeometry, streamMaterial);
        stream.position.set(offset[0], offset[1] - height * 0.5, offset[2]);

        const dropletGeometry = new THREE.SphereGeometry(0.035, 6, 4);
        const dropletMaterial = new THREE.MeshBasicMaterial({
            color: '#d9fbff',
            transparent: true,
            opacity: 0.75,
        });
        const droplets = new THREE.InstancedMesh(
            dropletGeometry,
            dropletMaterial,
            12,
        );
        const matrix = new THREE.Matrix4();

        for (let index = 0; index < 12; index += 1) {
            matrix.makeTranslation(
                offset[0] + ((index % 3) - 1) * 0.055,
                offset[1] - (index / 12) * height,
                offset[2] + ((index % 3) - 1) * 0.035,
            );
            droplets.setMatrixAt(index, matrix);
        }

        return { stream, droplets, speed: 1.7, height, topY: offset[1] };
    }

    private createCloudBands(): void {
        const cloudMaterial = new THREE.MeshBasicMaterial({
            color: '#eff8fb',
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
        });

        for (let index = 0; index < 6; index += 1) {
            const cloud = new THREE.Mesh(
                new THREE.SphereGeometry(0.58 + (index % 3) * 0.18, 10, 7),
                cloudMaterial,
            );
            const side = index % 2 === 0 ? -1 : 1;
            cloud.position.set(
                side * (3.4 + (index % 4) * 1.25),
                -0.15 - (index % 4) * 0.56,
                Math.cos(index * 1.08) * 6.4,
            );
            cloud.scale.set(2.2, 0.28, 0.62);
            this.atmosphere.add(cloud);
        }
    }

    private createWeatherParticles(color: string, count: number): void {
        const existing = this.weatherParticles.find(
            (particles) => particles.count === count,
        );

        if (existing) {
            const material = existing.material as THREE.MeshBasicMaterial;
            material.color.set(color);
            existing.visible = true;

            return;
        }

        const particles = new THREE.InstancedMesh(
            new THREE.SphereGeometry(0.025, 5, 4),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.58,
            }),
            count,
        );
        const matrix = new THREE.Matrix4();

        for (let index = 0; index < count; index += 1) {
            matrix.makeTranslation(
                Math.sin(index * 12.93) * 6.8,
                3.7 - (index % 18) * 0.32,
                Math.cos(index * 8.21) * 5.2,
            );
            particles.setMatrixAt(index, matrix);
        }

        this.weatherParticles.push(particles);
        this.atmosphere.add(particles);
    }

    private createSalemFallback(): void {
        this.fallbackSalem.scale.setScalar(1.12);
        this.fallbackSalem.position.y = 0.08;

        const fur = new THREE.MeshStandardMaterial({
            color: '#171920',
            roughness: 0.62,
            flatShading: true,
        });
        const belly = new THREE.MeshStandardMaterial({
            color: '#252a34',
            roughness: 0.68,
            flatShading: true,
        });
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#a7f3d0' });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), fur);
        body.scale.set(1.26, 0.72, 0.78);
        body.position.y = 0.14;
        body.castShadow = true;
        this.salemBody = body;
        this.fallbackSalem.add(body);

        const chest = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 10, 7),
            belly,
        );
        chest.scale.set(0.6, 0.3, 0.8);
        chest.position.set(0.2, 0.11, 0);
        this.fallbackSalem.add(chest);

        const headGroup = new THREE.Group();
        headGroup.position.set(0.33, 0.29, 0);
        this.salemHead = headGroup;
        this.fallbackSalem.add(headGroup);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), fur);
        head.castShadow = true;
        headGroup.add(head);

        for (const z of [-0.085, 0.085]) {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.032, 8, 6),
                eyeMaterial,
            );
            eye.position.set(0.17, 0.035, z);
            this.salemEyes.push(eye);
            headGroup.add(eye);
        }

        for (const z of [-0.11, 0.11]) {
            const ear = new THREE.Mesh(
                new THREE.ConeGeometry(0.085, 0.2, 3),
                fur,
            );
            ear.position.set(-0.01, 0.21, z);
            ear.rotation.set(0, 0.18, z > 0 ? -0.22 : 0.22);
            headGroup.add(ear);
        }

        for (const z of [-0.16, 0.16]) {
            const paw = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 8, 5),
                fur,
            );
            paw.scale.set(1.25, 0.5, 0.7);
            paw.position.set(0.22, -0.04, z);
            paw.castShadow = true;
            this.fallbackSalem.add(paw);
        }

        const tailGroup = new THREE.Group();
        tailGroup.position.set(-0.42, 0.27, 0);
        tailGroup.rotation.z = 1.05;
        this.salemTail = tailGroup;
        this.fallbackSalem.add(tailGroup);

        for (let index = 0; index < 3; index += 1) {
            const segment = new THREE.Mesh(
                new THREE.CylinderGeometry(0.038, 0.042, 0.24, 6),
                fur,
            );
            segment.position.y = index * 0.16;
            segment.rotation.z = -0.18 + index * 0.1;
            segment.castShadow = true;
            tailGroup.add(segment);
        }

        this.catAnchor.add(this.fallbackSalem);
    }

    private createProgrammingPaws(): void {
        const material = new THREE.MeshStandardMaterial({
            color: '#15161c',
            roughness: 0.5,
        });

        for (const z of [-0.13, 0.13]) {
            const paw = new THREE.Mesh(
                new THREE.SphereGeometry(0.055, 8, 6),
                material,
            );
            paw.position.set(0.23, 0.12, z);
            this.programmingPaws.add(paw);
        }

        this.programmingPaws.visible = false;
        this.catAnchor.add(this.programmingPaws);
    }

    private attachEvents(): void {
        window.addEventListener('resize', this.resize);
        this.renderer.domElement.addEventListener(
            'pointerdown',
            this.onPointerDown,
        );
        this.renderer.domElement.addEventListener(
            'pointermove',
            this.onPointerMove,
        );
        window.addEventListener('pointerup', this.onPointerUp);
        this.renderer.domElement.addEventListener('wheel', this.onWheel, {
            passive: false,
        });
    }

    private readonly resize = (): void => {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / Math.max(height, 1);
        const distance = width < 720 ? 17.4 : aspect > 2.1 ? 16.2 : 15.2;

        this.camera.aspect = aspect;
        this.camera.position.set(
            distance * 0.56,
            distance * 0.46,
            distance * 0.69,
        );
        this.camera.lookAt(0.1, 0.18, 0.18);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    };

    private readonly onPointerDown = (event: PointerEvent): void => {
        this.pointerStart = {
            x: event.clientX,
            y: event.clientY,
            rotation: this.rootRotation,
            dragging: false,
        };
        this.renderer.domElement.style.cursor = 'grabbing';
        this.renderer.domElement.setPointerCapture(event.pointerId);
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        if (!this.pointerStart) {
            return;
        }

        const movement = Math.hypot(
            event.clientX - this.pointerStart.x,
            event.clientY - this.pointerStart.y,
        );
        this.pointerStart.dragging ||= movement > 5;

        const delta = (event.clientX - this.pointerStart.x) / 420;
        this.rootRotation = this.pointerStart.rotation + delta;
    };

    private readonly onPointerUp = (event: PointerEvent): void => {
        if (this.pointerStart && !this.pointerStart.dragging) {
            this.handleWorldClick(event);
        }

        if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
            this.renderer.domElement.releasePointerCapture(event.pointerId);
        }

        this.pointerStart = null;
        this.renderer.domElement.style.cursor = 'grab';
    };

    private handleWorldClick(event: PointerEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const hits = this.raycaster.intersectObjects(
            [...this.interactionTargets.keys()],
            true,
        );
        const hit = hits.find((item) =>
            this.findInteractionTarget(item.object),
        );

        if (!hit) {
            return;
        }

        const target = this.findInteractionTarget(hit.object);

        if (!target) {
            return;
        }

        if (target.weather) {
            this.setWeather(target.weather);
            this.options.onWeatherChange(target.weather);
        }

        if (target.action === 'program') {
            this.startProgramming();

            return;
        }

        if (target.action === 'inspect') {
            this.forceAction('inspect');
            this.manualMoveTarget = target.target;
            this.options.onActionRequest('inspect');

            return;
        }

        const destination = (
            target.target ?? this.root.worldToLocal(hit.point.clone())
        ).clone();

        if (this.isNearProgrammingArea(destination)) {
            this.startProgramming();

            return;
        }

        destination.y += 0.26;
        this.moveSalemTo(destination);
        this.options.onActionRequest('walk');
    }

    private startProgramming(): void {
        this.forceAction('program');
        this.options.onActionRequest('program');
    }

    private isNearProgrammingArea(point: THREE.Vector3): boolean {
        const laptop = new THREE.Vector3(...programmingSpot.laptop);
        const seat = new THREE.Vector3(...programmingSpot.seat);

        return point.distanceTo(laptop) < 1.15 || point.distanceTo(seat) < 1.05;
    }

    private moveSalemTo(target: THREE.Vector3): void {
        this.manualMoveTarget = target.clone();
        const delta = target.clone().sub(this.catAnchor.position);

        if (delta.lengthSq() > 0.001) {
            this.desiredFacing = Math.atan2(delta.x, delta.z) - Math.PI * 0.5;
        }

        this.currentAction = 'walk';
        this.actionStartedAt = performance.now();
        this.options.onActionChange('walk');
    }

    private registerInteraction(
        object: THREE.Object3D,
        target: InteractionTarget,
    ): void {
        this.interactionTargets.set(object, target);
    }

    private findInteractionTarget(
        object: THREE.Object3D,
    ): InteractionTarget | undefined {
        let current: THREE.Object3D | null = object;

        while (current) {
            const target = this.interactionTargets.get(current);

            if (target) {
                return target;
            }

            current = current.parent;
        }

        return undefined;
    }

    private readonly onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const zoom = THREE.MathUtils.clamp(
            this.camera.zoom + (event.deltaY > 0 ? -0.06 : 0.06),
            0.72,
            1.34,
        );
        this.camera.zoom = zoom;
        this.camera.updateProjectionMatrix();
    };

    private animate = (): void => {
        const now = performance.now();

        if (now - this.lastRenderAt < 1000 / 45) {
            this.animationFrame = requestAnimationFrame(this.animate);

            return;
        }

        this.lastRenderAt = now;
        const delta = Math.min((now - this.lastTickAt) / 1000, 0.05);
        this.lastTickAt = now;
        this.elapsedSeconds += delta;
        const elapsed = this.elapsedSeconds;

        if (!document.hidden) {
            this.updateRoot(delta);
            this.updateFloatingIslands(elapsed);
            this.updateAnimatedFeatures(elapsed, delta);
            this.updateWaterfalls(elapsed);
            this.updateWeatherParticles(elapsed);
            this.updateSalem(delta, elapsed);
            this.renderer.render(this.scene, this.camera);
        }

        this.animationFrame = requestAnimationFrame(this.animate);
    };

    private updateRoot(delta: number): void {
        this.root.rotation.y = THREE.MathUtils.damp(
            this.root.rotation.y,
            this.rootRotation,
            5,
            delta,
        );
    }

    private updateFloatingIslands(elapsed: number): void {
        this.floatingIslands.forEach((island) => {
            island.group.position.y =
                island.baseY +
                Math.sin(elapsed * island.speed + island.phase) *
                    island.amplitude;
        });
    }

    private updateAnimatedFeatures(elapsed: number, delta: number): void {
        this.animatedFeatures.forEach((feature) => {
            feature.object.position.y =
                feature.baseY +
                Math.sin(elapsed * 1.8 + feature.phase) * feature.bob;
            feature.object.rotation.y += feature.spin * delta;
        });
    }

    private updateWaterfalls(elapsed: number): void {
        const matrix = new THREE.Matrix4();

        this.waterFalls.forEach((waterfall) => {
            waterfall.stream.scale.y = 1 + Math.sin(elapsed * 5.5) * 0.025;

            for (let index = 0; index < waterfall.droplets.count; index += 1) {
                waterfall.droplets.getMatrixAt(index, matrix);
                const position = new THREE.Vector3().setFromMatrixPosition(
                    matrix,
                );
                const nextY =
                    waterfall.topY -
                    ((elapsed * waterfall.speed + index * 0.31) %
                        waterfall.height);
                matrix.makeTranslation(position.x, nextY, position.z);
                waterfall.droplets.setMatrixAt(index, matrix);
            }

            waterfall.droplets.instanceMatrix.needsUpdate = true;
        });
    }

    private updateWeatherParticles(elapsed: number): void {
        const matrix = new THREE.Matrix4();

        this.weatherParticles.forEach((particles) => {
            if (!particles.visible) {
                return;
            }

            for (let index = 0; index < particles.count; index += 1) {
                const y = 4 - ((elapsed * 0.45 + index * 0.23) % 6.2);
                matrix.makeTranslation(
                    Math.sin(index * 12.93 + elapsed * 0.08) * 6.8,
                    y,
                    Math.cos(index * 8.21) * 5.2,
                );
                particles.setMatrixAt(index, matrix);
            }

            particles.instanceMatrix.needsUpdate = true;
        });
    }

    private updateSalem(delta: number, elapsed: number): void {
        const elapsedMs = performance.now() - this.actionStartedAt;
        const step = sequenceStepAt(this.currentAction, elapsedMs);
        const target = this.targetForAction(
            this.currentAction,
            step.phase,
            elapsed,
        );
        const nextPosition = new THREE.Vector3(...target);

        this.catAnchor.position.lerp(nextPosition, Math.min(1, delta * 2.2));
        this.catAnchor.rotation.y = THREE.MathUtils.damp(
            this.catAnchor.rotation.y,
            this.rotationForAction(this.currentAction, step.phase),
            6,
            delta,
        );
        this.catAnchor.scale.y = THREE.MathUtils.damp(
            this.catAnchor.scale.y,
            this.scaleForAction(this.currentAction, step.phase, elapsed),
            7,
            delta,
        );
        this.updateSalemRig(this.currentAction, step.phase, elapsed, delta);
        this.programmingPaws.visible =
            this.currentAction === 'program' && step.phase === 'acting';
        this.updateLaptop(elapsed);

        if (
            this.currentAction === 'walk' &&
            this.manualMoveTarget &&
            this.catAnchor.position.distanceTo(this.manualMoveTarget) < 0.08
        ) {
            this.manualMoveTarget = undefined;
            this.forceAction('idle');

            return;
        }

        if (
            elapsedMs > actionDuration(this.currentAction) &&
            this.currentAction !== 'idle'
        ) {
            this.forceAction('idle');
        }
    }

    private targetForAction(
        action: SalemAction,
        phase: string,
        elapsed: number,
    ): [number, number, number] {
        if (action === 'program') {
            return phase === 'moving'
                ? programmingSpot.approach
                : programmingSpot.seat;
        }

        if (action === 'sleep') {
            return salemHome.sleep;
        }

        if (action === 'inspect') {
            return salemHome.inspect;
        }

        if (action === 'sit') {
            return [-0.35, 0.7, 1.38];
        }

        if (action === 'walk') {
            if (this.manualMoveTarget) {
                return [
                    this.manualMoveTarget.x,
                    this.manualMoveTarget.y,
                    this.manualMoveTarget.z,
                ];
            }

            return [
                Math.sin(elapsed * 0.45) * 1.25,
                salemHome.idle[1],
                Math.cos(elapsed * 0.38) * 1.05,
            ];
        }

        return salemHome.idle;
    }

    private rotationForAction(action: SalemAction, phase: string): number {
        if (action === 'program' && phase !== 'moving') {
            return -2.35;
        }

        if (action === 'inspect') {
            return -1.2;
        }

        if (action === 'sleep') {
            return 0.2;
        }

        if (action === 'walk') {
            return this.desiredFacing;
        }

        return -0.55;
    }

    private scaleForAction(
        action: SalemAction,
        phase: string,
        elapsed: number,
    ): number {
        if (action === 'sleep') {
            return 0.82;
        }

        if (action === 'sit' || (action === 'program' && phase !== 'moving')) {
            return 0.92;
        }

        return 1 + Math.sin(elapsed * 2.8) * 0.025;
    }

    private updateSalemRig(
        action: SalemAction,
        phase: string,
        elapsed: number,
        delta: number,
    ): void {
        const moving = phase === 'moving' || action === 'walk';
        const programming = action === 'program' && phase === 'acting';
        const sleeping = action === 'sleep' && phase !== 'moving';
        const pulse = Math.sin(elapsed * (moving ? 10 : 2.4));

        if (this.salemBody) {
            this.salemBody.position.y = THREE.MathUtils.damp(
                this.salemBody.position.y,
                0.14 + (moving ? Math.abs(pulse) * 0.035 : 0),
                9,
                delta,
            );
            this.salemBody.rotation.z = THREE.MathUtils.damp(
                this.salemBody.rotation.z,
                sleeping ? 0.5 : moving ? pulse * 0.055 : 0,
                8,
                delta,
            );
        }

        if (this.salemHead) {
            this.salemHead.rotation.y = THREE.MathUtils.damp(
                this.salemHead.rotation.y,
                programming ? -0.28 : moving ? pulse * 0.05 : 0.08,
                7,
                delta,
            );
            this.salemHead.rotation.z = THREE.MathUtils.damp(
                this.salemHead.rotation.z,
                sleeping
                    ? 0.48
                    : programming
                      ? -0.12
                      : Math.sin(elapsed) * 0.04,
                7,
                delta,
            );
        }

        if (this.salemTail) {
            this.salemTail.rotation.z = THREE.MathUtils.damp(
                this.salemTail.rotation.z,
                sleeping ? 0.45 : 1.05 + Math.sin(elapsed * 3.2) * 0.22,
                6,
                delta,
            );
            this.salemTail.rotation.y = THREE.MathUtils.damp(
                this.salemTail.rotation.y,
                moving ? Math.sin(elapsed * 7.5) * 0.24 : 0,
                8,
                delta,
            );
        }

        const blink = Math.sin(elapsed * 1.7) > 0.985 ? 0.08 : 1;
        this.salemEyes.forEach((eye) => {
            eye.scale.y = THREE.MathUtils.damp(eye.scale.y, blink, 20, delta);
        });
    }

    private updateLaptop(elapsed: number): void {
        const isProgramming = this.currentAction === 'program';

        if (this.laptopScreen) {
            this.laptopScreen.emissiveIntensity = isProgramming
                ? 0.95 + Math.sin(elapsed * 4) * 0.18
                : 0.45;
        }

        if (this.laptopGlow) {
            this.laptopGlow.intensity = isProgramming ? 1.15 : 0.55;
        }

        this.laptopCodeLines.forEach((line, index) => {
            line.visible = isProgramming;
            line.scale.x = 0.65 + Math.sin(elapsed * 4.4 + index) * 0.18;
        });

        this.programmingPaws.children.forEach((paw, index) => {
            paw.position.y = 0.1 + Math.sin(elapsed * 8 + index) * 0.025;
        });
    }
}
