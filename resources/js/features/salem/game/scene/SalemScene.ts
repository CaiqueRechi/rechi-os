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

type SalemSceneOptions = {
    onActionChange: (action: SalemAction) => void;
    onAssetError: (message: string) => void;
};

type Waterfall = {
    stream: THREE.Mesh;
    droplets: THREE.InstancedMesh;
    speed: number;
    height: number;
};

export type SalemSceneHandle = {
    forceAction: (action: SalemAction) => void;
    resetPosition: () => void;
    setWeather: (weather: SalemWeather) => void;
    dispose: () => void;
};

export class SalemScene implements SalemSceneHandle {
    private readonly scene = new THREE.Scene();

    private readonly root = new THREE.Group();

    private readonly atmosphere = new THREE.Group();

    private readonly clock = new THREE.Clock();

    private readonly camera: THREE.OrthographicCamera;

    private readonly renderer: THREE.WebGLRenderer;

    private readonly assetLoader = new SalemAssetLoader();

    private readonly waterFalls: Waterfall[] = [];

    private readonly weatherParticles: THREE.InstancedMesh[] = [];

    private readonly laptopCodeLines: THREE.Mesh[] = [];

    private readonly programmingPaws = new THREE.Group();

    private readonly catAnchor = new THREE.Group();

    private readonly options: SalemSceneOptions;

    private readonly salemActions = new Map<string, THREE.AnimationAction>();

    private animationFrame: number | null = null;

    private salemMixer?: THREE.AnimationMixer;

    private activeSalemAnimation?: THREE.AnimationAction;

    private activeSalemAnimationName?: string;

    private sunlight?: THREE.DirectionalLight;

    private hemisphere?: THREE.HemisphereLight;

    private laptopGlow?: THREE.PointLight;

    private laptopScreen?: THREE.MeshStandardMaterial;

    private currentAction: SalemAction = 'idle';

    private actionStartedAt = performance.now();

    private rootRotation = -0.28;

    private pointerStart: { x: number; rotation: number } | null = null;

    public constructor(
        private readonly container: HTMLElement,
        options: SalemSceneOptions,
    ) {
        this.options = options;
        this.camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 80);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });

        this.configureRenderer();
        this.createWorld();
        this.createSalemFallback();
        this.loadSalemAsset();
        this.attachEvents();
        this.setWeather('clear');
        this.resize();
        this.animate();
    }

    public forceAction(action: SalemAction): void {
        this.currentAction = action;
        this.actionStartedAt = performance.now();
        this.options.onActionChange(action);
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.domElement.className = 'block size-full';
        this.container.appendChild(this.renderer.domElement);
    }

    private createWorld(): void {
        this.root.rotation.y = this.rootRotation;
        this.root.position.y = -0.15;
        this.atmosphere.position.y = -0.1;
        this.scene.add(this.atmosphere);
        this.scene.add(this.root);

        this.hemisphere = new THREE.HemisphereLight('#eefcff', '#83745f', 1.05);
        this.scene.add(this.hemisphere);

        this.sunlight = new THREE.DirectionalLight('#fff2c8', 2.7);
        this.sunlight.position.set(-5, 9, 7);
        this.sunlight.castShadow = true;
        this.sunlight.shadow.mapSize.set(2048, 2048);
        this.sunlight.shadow.camera.left = -9;
        this.sunlight.shadow.camera.right = 9;
        this.sunlight.shadow.camera.top = 8;
        this.sunlight.shadow.camera.bottom = -8;
        this.scene.add(this.sunlight);

        const fillLight = new THREE.DirectionalLight('#8fe1ff', 0.3);
        fillLight.position.set(6, 3, -5);
        this.scene.add(fillLight);

        this.laptopGlow = new THREE.PointLight('#7dd3fc', 0.55, 5);
        this.laptopGlow.position.set(...programmingSpot.laptop);
        this.root.add(this.laptopGlow);

        islandConfigs.forEach((island) =>
            this.root.add(this.createIsland(island)),
        );
        this.createDecorativeFragments();
        this.createCloudBands();
        this.createProgrammingPaws();
        this.root.add(this.catAnchor);
        this.resetPosition();
    }

    private createIsland(island: IslandConfig): THREE.Group {
        const group = new THREE.Group();
        group.position.set(...island.position);

        const islandScale =
            island.id === 'home' ? new THREE.Vector3(1.16, 1, 0.82) : null;
        const islandSeed = this.seedFromString(island.id);

        const grass = new THREE.Mesh(
            this.createIrregularCylinderGeometry(
                island.radius,
                island.radius * 0.94,
                0.3,
                28,
                islandSeed,
                0.075,
            ),
            new THREE.MeshStandardMaterial({
                color: island.color,
                roughness: 0.82,
                metalness: 0,
                flatShading: false,
            }),
        );
        grass.position.y = island.height * 0.5;
        grass.scale.copy(islandScale ?? new THREE.Vector3(1, 1, 1));
        grass.castShadow = true;
        grass.receiveShadow = true;
        group.add(grass);

        const rim = new THREE.Mesh(
            this.createIrregularCylinderGeometry(
                island.radius * 1.01,
                island.radius * 0.98,
                0.12,
                28,
                islandSeed,
                0.09,
            ),
            new THREE.MeshStandardMaterial({
                color: '#325f48',
                roughness: 0.78,
                metalness: 0,
                flatShading: false,
            }),
        );
        rim.position.y = island.height * 0.34;
        rim.scale.copy(islandScale ?? new THREE.Vector3(1, 1, 1));
        rim.castShadow = true;
        rim.receiveShadow = true;
        group.add(rim);

        this.addFloatingRockBase(group, island, islandScale);

        this.addGrassDetails(group, island, islandScale);

        this.addIslandProps(group, island);

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

    private addFloatingRockBase(
        group: THREE.Group,
        island: IslandConfig,
        islandScale: THREE.Vector3 | null,
    ): void {
        const scale = islandScale ?? new THREE.Vector3(1, 1, 1);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: island.soilColor,
            roughness: 0.82,
            metalness: 0,
            flatShading: false,
        });
        const darkRockMaterial = new THREE.MeshStandardMaterial({
            color: '#3f3d46',
            roughness: 0.85,
            metalness: 0,
            flatShading: false,
        });
        const islandSeed = this.seedFromString(island.id);

        const upperRock = new THREE.Mesh(
            this.createIrregularCylinderGeometry(
                island.radius * 0.94,
                island.radius * 0.76,
                island.height * 0.72,
                24,
                islandSeed + 17,
                0.12,
            ),
            rockMaterial,
        );
        upperRock.position.y = island.height * 0.03;
        upperRock.scale.set(scale.x, 1, scale.z);
        upperRock.castShadow = true;
        upperRock.receiveShadow = true;
        group.add(upperRock);

        const lowerRock = new THREE.Mesh(
            this.createIrregularCylinderGeometry(
                island.radius * 0.58,
                island.radius * 0.4,
                island.height * 0.46,
                20,
                islandSeed + 41,
                0.17,
            ),
            darkRockMaterial,
        );
        lowerRock.position.y = -island.height * 0.52;
        lowerRock.scale.set(scale.x * 0.92, 1, scale.z * 0.9);
        lowerRock.rotation.y = 0.28;
        lowerRock.castShadow = true;
        group.add(lowerRock);

        const glowRing = new THREE.Mesh(
            new THREE.TorusGeometry(island.radius * 0.66, 0.018, 6, 40),
            new THREE.MeshBasicMaterial({
                color: '#9de7ff',
                transparent: true,
                opacity: island.id === 'home' ? 0.28 : 0.18,
            }),
        );
        glowRing.position.y = -island.height * 0.82;
        glowRing.rotation.x = Math.PI * 0.5;
        glowRing.scale.set(scale.x * 0.8, scale.z * 0.8, 1);
        group.add(glowRing);

        for (let index = 0; index < 10; index += 1) {
            const angle = index * 1.71;
            const distance = island.radius * (0.34 + (index % 4) * 0.12);
            const shard = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.16 + (index % 3) * 0.05, 0),
                index % 3 === 0 ? darkRockMaterial : rockMaterial,
            );
            shard.position.set(
                Math.cos(angle) * distance * scale.x,
                -island.height * (0.26 + (index % 4) * 0.15),
                Math.sin(angle) * distance * scale.z,
            );
            shard.rotation.set(index * 0.23, index * 0.37, index * 0.14);
            shard.scale.set(
                1.1 + (index % 2) * 0.28,
                0.42 + (index % 3) * 0.12,
                0.82 + (index % 2) * 0.18,
            );
            shard.castShadow = true;
            group.add(shard);
        }
    }

    private addGrassDetails(
        group: THREE.Group,
        island: IslandConfig,
        islandScale: THREE.Vector3 | null,
    ): void {
        const highlight = new THREE.Mesh(
            new THREE.CircleGeometry(island.radius * 0.72, 32),
            new THREE.MeshBasicMaterial({
                color: island.biome === 'autumn' ? '#f2a45d' : '#a7df72',
                transparent: true,
                opacity: island.id === 'home' ? 0.22 : 0.16,
            }),
        );
        highlight.rotation.x = -Math.PI * 0.5;
        highlight.position.set(-0.35, island.height * 0.5 + 0.156, -0.22);
        highlight.scale.copy(islandScale ?? new THREE.Vector3(1, 1, 1));
        group.add(highlight);

        const path = new THREE.Mesh(
            new THREE.CircleGeometry(island.radius * 0.36, 24),
            new THREE.MeshBasicMaterial({
                color: island.biome === 'rocky' ? '#a5aea8' : '#e2bf8f',
                transparent: true,
                opacity: island.id === 'home' ? 0.26 : 0.12,
            }),
        );
        path.rotation.x = -Math.PI * 0.5;
        path.scale.set(
            islandScale ? islandScale.x * 1.15 : 1.15,
            islandScale ? islandScale.z * 0.58 : 0.58,
            1,
        );
        path.position.set(0.75, island.height * 0.5 + 0.158, 0.88);
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

    private addGroundScatter(
        group: THREE.Group,
        island: IslandConfig,
        islandScale: THREE.Vector3 | null,
    ): void {
        const scale = islandScale ?? new THREE.Vector3(1, 1, 1);
        group.add(this.createGrassScatter(island, scale));
        group.add(this.createPebbleScatter(island, scale));

        if (island.props.includes('trees')) {
            group.add(this.createSaplingScatter(island, scale));
        }
    }

    private createGrassScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.InstancedMesh {
        const count =
            island.id === 'home' ? 48 : Math.round(12 + island.radius * 10);
        const colors = this.scatterColorsForBiome(island.biome);
        const grass = new THREE.InstancedMesh(
            new THREE.ConeGeometry(0.025, 0.28, 3),
            new THREE.MeshStandardMaterial({
                color: colors.grass,
                roughness: 0.74,
                flatShading: true,
                vertexColors: true,
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
            position.y += 0.08;
            rotation.set(
                this.randomSigned(index, 3.7) * 0.18,
                this.random(index, 8.9) * Math.PI * 2,
                this.randomSigned(index, 11.2) * 0.14,
            );
            quaternion.setFromEuler(rotation);
            const height = 0.92 + this.random(index, 18.4) * 0.16;
            size.set(
                0.92 + this.random(index, 41.2) * 0.16,
                height,
                0.92 + this.random(index, 51.2) * 0.16,
            );
            matrix.compose(position, quaternion, size);
            grass.setMatrixAt(index, matrix);
            grass.setColorAt(
                index,
                this.variedColor(colors.grass, colors.grassAccent, index, 4.8),
            );
        }

        grass.receiveShadow = true;

        return grass;
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
                vertexColors: true,
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
            pebbles.setColorAt(
                index,
                this.variedColor(colors.stone, colors.stoneAccent, index, 1.8),
            );
        }

        pebbles.castShadow = true;
        pebbles.receiveShadow = true;

        return pebbles;
    }

    private createSaplingScatter(
        island: IslandConfig,
        islandScale: THREE.Vector3,
    ): THREE.Group {
        const group = new THREE.Group();
        const count =
            island.id === 'home'
                ? 6
                : Math.max(2, Math.round(island.radius * 1.6));
        const colors = this.scatterColorsForBiome(island.biome);
        const trunks = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.025, 0.04, 0.42, 5),
            new THREE.MeshStandardMaterial({
                color: '#6b4935',
                roughness: 0.65,
                flatShading: true,
            }),
            count,
        );
        const canopies = new THREE.InstancedMesh(
            new THREE.ConeGeometry(0.18, 0.46, 6),
            new THREE.MeshStandardMaterial({
                color: colors.tree,
                roughness: 0.72,
                flatShading: true,
                vertexColors: true,
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
                this.scatterPointOnIsland(island, islandScale, index, 129.3),
            );
            rotation.set(0, this.random(index, 9.4) * Math.PI * 2, 0);
            quaternion.setFromEuler(rotation);
            const treeSize =
                island.id === 'home'
                    ? 0.92 + this.random(index, 44.5) * 0.16
                    : 0.84 + this.random(index, 44.5) * 0.16;

            position.y += 0.2 * treeSize;
            size.setScalar(treeSize);
            matrix.compose(position, quaternion, size);
            trunks.setMatrixAt(index, matrix);

            position.y += 0.33 * treeSize;
            size.setScalar(treeSize * (0.94 + this.random(index, 18.9) * 0.12));
            matrix.compose(position, quaternion, size);
            canopies.setMatrixAt(index, matrix);
            canopies.setColorAt(
                index,
                this.variedColor(colors.tree, colors.treeAccent, index, 7.1),
            );
        }

        trunks.castShadow = true;
        canopies.castShadow = true;
        group.add(trunks);
        group.add(canopies);

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
                island.height * 0.5 + 0.17,
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

    private variedColor(
        base: string,
        accent: string,
        index: number,
        seed: number,
    ): THREE.Color {
        return new THREE.Color(base).lerp(
            new THREE.Color(accent),
            0.08 + this.random(index, seed) * 0.16,
        );
    }

    private seedFromString(value: string): number {
        let hash = 2166136261;

        for (let index = 0; index < value.length; index += 1) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
    }

    private createIrregularCylinderGeometry(
        topRadius: number,
        bottomRadius: number,
        height: number,
        radialSegments: number,
        seed: number,
        strength: number,
    ): THREE.CylinderGeometry {
        const geometry = new THREE.CylinderGeometry(
            topRadius,
            bottomRadius,
            height,
            radialSegments,
            2,
        );
        const positions = geometry.getAttribute('position');

        for (let index = 0; index < positions.count; index += 1) {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const z = positions.getZ(index);
            const radius = Math.hypot(x, z);

            if (radius < 0.0001) {
                continue;
            }

            const angle = Math.atan2(z, x);
            const expectedRadius = y >= 0 ? topRadius : bottomRadius;
            const edgeFactor = Math.min(1, radius / expectedRadius);
            const radialScale =
                1 +
                this.radialShapeNoise(angle, seed) *
                    strength *
                    (0.55 + edgeFactor * 0.45);
            const verticalOffset =
                this.radialShapeNoise(angle + 0.63, seed + 19) *
                Math.min(0.035, height * 0.035) *
                Math.max(0, (edgeFactor - 0.45) / 0.55);

            positions.setXYZ(
                index,
                x * radialScale,
                y + verticalOffset,
                z * radialScale,
            );
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
                this.createTrees(island.biome),
            );
        }

        if (island.props.includes('flowers')) {
            this.addAssetRole(
                group,
                island,
                'flowers',
                this.createFlowers(island.radius),
            );
        }

        if (island.props.includes('rocks')) {
            this.addAssetRole(
                group,
                island,
                'rocks',
                this.createRocks(island.radius),
            );
        }

        if (island.props.includes('pool')) {
            this.addPool(group);
        }

        if (island.props.includes('lantern')) {
            group.add(this.createLantern(island.biome));
        }

        if (island.props.includes('stumps')) {
            this.addAssetRole(group, island, 'stumps', this.createStump());
        }

        this.addAssetRole(group, island, 'decor');
    }

    private addAssetRole(
        group: THREE.Group,
        island: IslandConfig,
        role: IslandAssetRole,
        fallback?: THREE.Group,
    ): void {
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
        group.position.set(-0.85, 0.96, -0.85);
        group.rotation.y = -0.35;

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.35, 1.05, 1.1),
            new THREE.MeshStandardMaterial({
                color: '#b77948',
                roughness: 0.8,
            }),
        );
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(1.08, 0.72, 4),
            new THREE.MeshStandardMaterial({
                color: '#563b46',
                roughness: 0.72,
                flatShading: true,
            }),
        );
        roof.position.y = 0.82;
        roof.rotation.y = Math.PI * 0.25;
        roof.castShadow = true;
        group.add(roof);

        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.58, 0.04),
            new THREE.MeshStandardMaterial({
                color: '#4f332a',
                roughness: 0.6,
            }),
        );
        door.position.set(0, -0.2, 0.57);
        group.add(door);

        const windowMaterial = new THREE.MeshStandardMaterial({
            color: '#ffe7a3',
            emissive: '#ffb84a',
            emissiveIntensity: 0.9,
            roughness: 0.35,
        });
        const window = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.24, 0.045),
            windowMaterial,
        );
        window.position.set(0.42, 0.1, 0.57);
        group.add(window);

        return group;
    }

    private createChair(): THREE.Group {
        const group = new THREE.Group();
        group.position.set(1.9, 0.82, 1.18);
        group.rotation.y = -0.72;

        const wood = new THREE.MeshStandardMaterial({
            color: '#7b563f',
            roughness: 0.7,
        });
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.12, 0.52),
            wood,
        );
        seat.castShadow = true;
        group.add(seat);

        const back = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.68, 0.1),
            wood,
        );
        back.position.set(0, 0.33, -0.25);
        back.castShadow = true;
        group.add(back);

        for (const x of [-0.22, 0.22]) {
            for (const z of [-0.2, 0.2]) {
                const leg = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08, 0.48, 0.08),
                    wood,
                );
                leg.position.set(x, -0.28, z);
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
            color: '#263446',
            metalness: 0.2,
            roughness: 0.45,
        });
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.06, 0.42),
            shell,
        );
        group.add(base);

        this.laptopScreen = new THREE.MeshStandardMaterial({
            color: '#10233d',
            emissive: '#38bdf8',
            emissiveIntensity: 0.6,
            roughness: 0.35,
        });

        const screen = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.42, 0.05),
            this.laptopScreen,
        );
        screen.position.set(0, 0.24, -0.18);
        screen.rotation.x = -0.34;
        group.add(screen);

        const lineMaterial = new THREE.MeshBasicMaterial({ color: '#b8f7ff' });

        for (let index = 0; index < 5; index += 1) {
            const line = new THREE.Mesh(
                new THREE.BoxGeometry(0.34 - index * 0.035, 0.014, 0.012),
                lineMaterial.clone(),
            );
            line.position.set(-0.05, 0.2 + index * 0.045, -0.214);
            line.rotation.x = -0.34;
            this.laptopCodeLines.push(line);
            group.add(line);
        }

        return group;
    }

    private createTrees(biome: IslandBiome): THREE.Group {
        const group = new THREE.Group();
        const leafColors: Record<IslandBiome, string[]> = {
            home: ['#2f7d54', '#68a85a'],
            meadow: ['#3f9a55', '#88c95f'],
            rocky: ['#718078', '#a1aa91'],
            tropical: ['#1d9073', '#54c28b'],
            autumn: ['#b95d45', '#d8a44e'],
        };
        const positions = [
            [-2.15, 0.9, -0.1],
            [-1.7, 0.9, 1.35],
            [1.25, 0.9, -1.65],
        ];

        positions.forEach((position, index) => {
            const tree = new THREE.Group();
            tree.position.set(position[0], 0.12, position[2]);
            tree.scale.setScalar(
                (index === 1 ? 0.86 : 0.96) + this.random(index, 84.2) * 0.08,
            );
            tree.rotation.y = this.randomSigned(index, 91.7) * 0.14;

            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.12, 0.72, 6),
                new THREE.MeshStandardMaterial({
                    color: '#75513a',
                    roughness: 0.9,
                }),
            );
            trunk.position.y = 0.58;
            trunk.castShadow = true;
            tree.add(trunk);

            const leaves = new THREE.Mesh(
                new THREE.ConeGeometry(0.48, 1.0, 7),
                new THREE.MeshStandardMaterial({
                    color: leafColors[biome][index % 2],
                    roughness: 0.85,
                    flatShading: true,
                }),
            );
            leaves.position.y = 1.18;
            leaves.castShadow = true;
            tree.add(leaves);

            const lowerLeaves = new THREE.Mesh(
                new THREE.ConeGeometry(0.58, 0.82, 7),
                new THREE.MeshStandardMaterial({
                    color: leafColors[biome][(index + 1) % 2],
                    roughness: 0.86,
                    flatShading: true,
                }),
            );
            lowerLeaves.position.y = 0.86;
            lowerLeaves.castShadow = true;
            tree.add(lowerLeaves);
            group.add(tree);
        });

        return group;
    }

    private createFlowers(radius: number): THREE.Group {
        const group = new THREE.Group();
        const colors = ['#f8c8dc', '#ffe28a', '#c7f9ff'];
        const clusterCount = 4;

        for (let index = 0; index < 14; index += 1) {
            const cluster = index % clusterCount;
            const centerAngle =
                (cluster / clusterCount) * Math.PI * 2 +
                this.random(cluster, 142.3) * 0.8;
            const centerDistance =
                radius * (0.24 + this.random(cluster, 151.8) * 0.34);
            const jitterAngle = this.random(index, 163.4) * Math.PI * 2;
            const jitterDistance =
                radius * (0.03 + this.random(index, 171.2) * 0.11);
            const flower = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.055, 0),
                new THREE.MeshStandardMaterial({
                    color: colors[index % colors.length],
                }),
            );
            flower.position.set(
                Math.cos(centerAngle) * centerDistance +
                    Math.cos(jitterAngle) * jitterDistance,
                0.73,
                Math.sin(centerAngle) * centerDistance +
                    Math.sin(jitterAngle) * jitterDistance,
            );
            flower.scale.setScalar(0.94 + this.random(index, 180.6) * 0.12);
            flower.castShadow = true;
            group.add(flower);
        }

        return group;
    }

    private createRocks(radius: number): THREE.Group {
        const group = new THREE.Group();

        for (let index = 0; index < 9; index += 1) {
            const angle = index * 1.77;
            const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.16 + (index % 3) * 0.05, 0),
                new THREE.MeshStandardMaterial({
                    color: index % 2 === 0 ? '#7a8084' : '#9aa0a0',
                    roughness: 0.95,
                    flatShading: true,
                }),
            );
            rock.position.set(
                Math.cos(angle) * radius * 0.55,
                0.76,
                Math.sin(angle) * radius * 0.55,
            );
            rock.scale.y = 0.72;
            rock.castShadow = true;
            group.add(rock);
        }

        return group;
    }

    private addPool(group: THREE.Group): void {
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
        pool.position.set(-0.35, 0.68, 0.25);
        group.add(pool);
    }

    private createLantern(biome: IslandBiome): THREE.Group {
        const group = new THREE.Group();
        group.position.set(
            biome === 'home' ? 0.55 : -0.4,
            0.96,
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

    private createStump(): THREE.Group {
        const stump = new THREE.Group();
        stump.position.set(-0.2, 0.82, 0.6);
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
            opacity: 0.72,
            roughness: 0.1,
            emissive: '#2ea7c8',
            emissiveIntensity: 0.18,
        });
        const stream = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, height, 0.08),
            streamMaterial,
        );
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
            16,
        );
        const matrix = new THREE.Matrix4();

        for (let index = 0; index < 16; index += 1) {
            matrix.makeTranslation(
                offset[0] + ((index % 4) - 1.5) * 0.06,
                offset[1] - (index / 16) * height,
                offset[2] + ((index % 3) - 1) * 0.035,
            );
            droplets.setMatrixAt(index, matrix);
        }

        return { stream, droplets, speed: 1.7, height };
    }

    private createDecorativeFragments(): void {
        const fragmentMaterial = new THREE.MeshStandardMaterial({
            color: '#4d4d55',
            roughness: 0.95,
            flatShading: true,
        });

        for (let index = 0; index < 12; index += 1) {
            const fragment = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.08 + (index % 4) * 0.04, 0),
                fragmentMaterial,
            );
            fragment.position.set(
                Math.sin(index * 1.9) * 6.8,
                -2.1 - (index % 5) * 0.36,
                Math.cos(index * 1.31) * 4.8,
            );
            fragment.rotation.set(index * 0.17, index * 0.31, index * 0.11);
            this.root.add(fragment);
        }
    }

    private createCloudBands(): void {
        const cloudMaterial = new THREE.MeshBasicMaterial({
            color: '#eff8fb',
            transparent: true,
            opacity: 0.24,
            depthWrite: false,
        });

        for (let index = 0; index < 10; index += 1) {
            const cloud = new THREE.Mesh(
                new THREE.SphereGeometry(0.58 + (index % 3) * 0.18, 10, 7),
                cloudMaterial,
            );
            const side = index % 2 === 0 ? -1 : 1;
            cloud.position.set(
                side * (3.4 + (index % 4) * 1.25),
                -0.15 - (index % 4) * 0.56,
                Math.cos(index * 1.08) * 5.2,
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
        const material = new THREE.MeshStandardMaterial({
            color: '#1f2027',
            roughness: 0.62,
        });
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#a7f3d0' });
        const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 14, 10),
            material,
        );
        body.scale.set(1.2, 0.72, 0.72);
        body.position.y = 0.12;
        body.castShadow = true;
        this.catAnchor.add(body);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 12, 8),
            material,
        );
        head.position.set(0.32, 0.23, 0);
        head.castShadow = true;
        this.catAnchor.add(head);

        for (const z of [-0.09, 0.09]) {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.025, 8, 6),
                eyeMaterial,
            );
            eye.position.set(0.48, 0.27, z);
            this.catAnchor.add(eye);
        }

        for (const z of [-0.11, 0.11]) {
            const ear = new THREE.Mesh(
                new THREE.ConeGeometry(0.075, 0.18, 3),
                material,
            );
            ear.position.set(0.27, 0.43, z);
            ear.rotation.z = -0.18;
            this.catAnchor.add(ear);
        }

        const tail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.035, 0.62, 6),
            material,
        );
        tail.position.set(-0.42, 0.22, 0);
        tail.rotation.z = 1.05;
        tail.castShadow = true;
        this.catAnchor.add(tail);
    }

    private loadSalemAsset(): void {
        void this.assetLoader
            .load('salem')
            .then((gltf) => {
                const model = gltf.scene;
                model.scale.setScalar(0.0047);
                model.rotation.y = Math.PI * 0.5;
                this.assetLoader.configureShadows(model);
                this.assetLoader.applyMaterialTheme('salem', model);

                this.catAnchor.clear();
                this.catAnchor.add(model);
                this.catAnchor.add(this.createSalemFaceAccent());
                this.catAnchor.add(this.programmingPaws);

                this.salemMixer = new THREE.AnimationMixer(model);
                gltf.animations.forEach((clip) => {
                    this.salemActions.set(
                        clip.name,
                        this.salemMixer!.clipAction(clip),
                    );
                });
                this.playSalemAnimation('Idle');
            })
            .catch(() => {
                this.options.onAssetError(
                    'Salem model could not load, using fallback cat.',
                );
            });
    }

    private createSalemFaceAccent(): THREE.Group {
        const group = new THREE.Group();
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#9ff6cf' });

        for (const z of [-0.085, 0.085]) {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.022, 8, 6),
                eyeMaterial,
            );
            eye.position.set(0.36, 0.25, z);
            group.add(eye);
        }

        return group;
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
        const frustum = width < 720 ? 7.5 : 6.65;

        this.camera.left = (-frustum * aspect) / 2;
        this.camera.right = (frustum * aspect) / 2;
        this.camera.top = frustum / 2;
        this.camera.bottom = -frustum / 2;
        this.camera.position.set(5.7, 4.7, 7);
        this.camera.lookAt(0.1, 0.34, 0.18);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    };

    private readonly onPointerDown = (event: PointerEvent): void => {
        this.pointerStart = { x: event.clientX, rotation: this.rootRotation };
        this.renderer.domElement.setPointerCapture(event.pointerId);
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        if (!this.pointerStart) {
            return;
        }

        const delta = (event.clientX - this.pointerStart.x) / 420;
        this.rootRotation = THREE.MathUtils.clamp(
            this.pointerStart.rotation + delta,
            -0.78,
            0.55,
        );
    };

    private readonly onPointerUp = (): void => {
        this.pointerStart = null;
    };

    private readonly onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const zoom = THREE.MathUtils.clamp(
            this.camera.zoom + (event.deltaY > 0 ? -0.08 : 0.08),
            0.82,
            1.35,
        );
        this.camera.zoom = zoom;
        this.camera.updateProjectionMatrix();
    };

    private animate = (): void => {
        const delta = this.clock.getDelta();
        const elapsed = this.clock.elapsedTime;

        if (!document.hidden) {
            this.updateRoot(delta);
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

    private updateWaterfalls(elapsed: number): void {
        const matrix = new THREE.Matrix4();

        this.waterFalls.forEach((waterfall) => {
            waterfall.stream.scale.y = 1 + Math.sin(elapsed * 5.5) * 0.025;

            for (let index = 0; index < waterfall.droplets.count; index += 1) {
                waterfall.droplets.getMatrixAt(index, matrix);
                const position = new THREE.Vector3().setFromMatrixPosition(
                    matrix,
                );
                const nextY = -(
                    (elapsed * waterfall.speed + index * 0.31) %
                    waterfall.height
                );
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
        this.updateSalemAnimation(this.currentAction, step.phase);
        this.salemMixer?.update(delta);
        this.programmingPaws.visible =
            this.currentAction === 'program' && step.phase === 'acting';
        this.updateLaptop(elapsed);

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
            return [
                Math.sin(elapsed * 0.45) * 1.25,
                0.7,
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

        return -0.55;
    }

    private scaleForAction(
        action: SalemAction,
        phase: string,
        elapsed: number,
    ): number {
        if (action === 'sleep') {
            return 0.56;
        }

        if (action === 'sit' || (action === 'program' && phase !== 'moving')) {
            return 0.72;
        }

        return 1 + Math.sin(elapsed * 2.8) * 0.025;
    }

    private updateSalemAnimation(action: SalemAction, phase: string): void {
        if (phase === 'moving' || action === 'walk') {
            this.playSalemAnimation('Walk');

            return;
        }

        if (action === 'inspect') {
            this.playSalemAnimation('Yes');

            return;
        }

        this.playSalemAnimation('Idle');
    }

    private playSalemAnimation(name: string): void {
        const animationName = this.resolveSalemAnimationName(name);

        if (!animationName || animationName === this.activeSalemAnimationName) {
            return;
        }

        const nextAction = this.salemActions.get(animationName);

        if (!nextAction) {
            return;
        }

        nextAction.reset().fadeIn(0.2).play();
        this.activeSalemAnimation?.fadeOut(0.2);
        this.activeSalemAnimation = nextAction;
        this.activeSalemAnimationName = animationName;
    }

    private resolveSalemAnimationName(name: string): string | undefined {
        if (this.salemActions.has(name)) {
            return name;
        }

        return [...this.salemActions.keys()].find((animationName) =>
            animationName.endsWith(`|${name}`),
        );
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
