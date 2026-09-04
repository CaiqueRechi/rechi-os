import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { SalemAction, SalemWeather } from '@/types';

import { weatherPresets } from '../../environment/weather';
import { actionDuration, sequenceStepAt } from '../../state/salem-actions';
import { salemHome, islandConfigs, programmingSpot } from '../../world/islands';
import type { IslandBiome, IslandConfig } from '../../world/islands';

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

    private readonly clock = new THREE.Clock();

    private readonly camera: THREE.OrthographicCamera;

    private readonly renderer: THREE.WebGLRenderer;

    private readonly loader = new GLTFLoader();

    private readonly waterFalls: Waterfall[] = [];

    private readonly weatherParticles: THREE.InstancedMesh[] = [];

    private readonly laptopCodeLines: THREE.Mesh[] = [];

    private readonly programmingPaws = new THREE.Group();

    private readonly catAnchor = new THREE.Group();

    private readonly options: SalemSceneOptions;

    private animationFrame: number | null = null;

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
        this.scene.traverse((object) => {
            const mesh = object as THREE.Mesh;

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
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }

    private configureRenderer(): void {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.className = 'block size-full';
        this.container.appendChild(this.renderer.domElement);
    }

    private createWorld(): void {
        this.root.rotation.y = this.rootRotation;
        this.scene.add(this.root);

        this.hemisphere = new THREE.HemisphereLight('#dff8ff', '#7c8f68', 2);
        this.scene.add(this.hemisphere);

        this.sunlight = new THREE.DirectionalLight('#fff0b8', 2.35);
        this.sunlight.position.set(-4, 9, 6);
        this.sunlight.castShadow = true;
        this.sunlight.shadow.mapSize.set(1024, 1024);
        this.scene.add(this.sunlight);

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

        const grass = new THREE.Mesh(
            new THREE.CylinderGeometry(
                island.radius,
                island.radius * 0.9,
                0.34,
                11,
            ),
            new THREE.MeshStandardMaterial({
                color: island.color,
                roughness: 0.78,
                flatShading: true,
            }),
        );
        grass.position.y = island.height * 0.5;
        grass.castShadow = true;
        grass.receiveShadow = true;
        group.add(grass);

        const underside = new THREE.Mesh(
            new THREE.ConeGeometry(
                island.radius * 0.92,
                island.height * 2.4,
                10,
            ),
            new THREE.MeshStandardMaterial({
                color: island.soilColor,
                roughness: 0.95,
                flatShading: true,
            }),
        );
        underside.position.y = -island.height * 0.85;
        underside.castShadow = true;
        group.add(underside);

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

    private addIslandProps(group: THREE.Group, island: IslandConfig): void {
        if (island.props.includes('cabin')) {
            group.add(this.createCabin());
        }

        if (island.props.includes('chair')) {
            group.add(this.createChair());
        }

        if (island.props.includes('laptop')) {
            group.add(this.createLaptop());
        }

        if (island.props.includes('trees')) {
            this.addTrees(group, island.biome);
        }

        if (island.props.includes('flowers')) {
            this.addFlowers(group, island.radius);
        }

        if (island.props.includes('rocks')) {
            this.addRocks(group, island.radius);
        }

        if (island.props.includes('pool')) {
            this.addPool(group);
        }

        if (island.props.includes('lantern')) {
            group.add(this.createLantern(island.biome));
        }

        if (island.props.includes('stumps')) {
            group.add(this.createStump());
        }
    }

    private createCabin(): THREE.Group {
        const group = new THREE.Group();
        group.position.set(-0.85, 0.96, -0.85);
        group.rotation.y = -0.35;

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.35, 1.05, 1.1),
            new THREE.MeshStandardMaterial({
                color: '#c98e55',
                roughness: 0.8,
            }),
        );
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(1.08, 0.72, 4),
            new THREE.MeshStandardMaterial({
                color: '#6f4b67',
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

    private addTrees(group: THREE.Group, biome: IslandBiome): void {
        const leafColors: Record<IslandBiome, string[]> = {
            home: ['#4f9b52', '#6fbd61'],
            meadow: ['#4ea957', '#80c45e'],
            rocky: ['#6f8277', '#8b9a89'],
            tropical: ['#2f9a73', '#50c78e'],
            autumn: ['#c85f3f', '#d99b42'],
        };
        const positions = [
            [-2.15, 0.9, -0.1],
            [-1.7, 0.9, 1.35],
            [1.25, 0.9, -1.65],
        ];

        positions.forEach((position, index) => {
            const tree = new THREE.Group();
            tree.position.set(position[0], 0.12, position[2]);
            tree.scale.setScalar(index === 1 ? 0.82 : 1);

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
            group.add(tree);
        });
    }

    private addFlowers(group: THREE.Group, radius: number): void {
        const colors = ['#f8c8dc', '#ffe28a', '#c7f9ff'];

        for (let index = 0; index < 18; index += 1) {
            const angle = index * 2.17;
            const distance = radius * (0.22 + (index % 5) * 0.11);
            const flower = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.055, 0),
                new THREE.MeshStandardMaterial({
                    color: colors[index % colors.length],
                }),
            );
            flower.position.set(
                Math.cos(angle) * distance,
                0.72,
                Math.sin(angle) * distance,
            );
            group.add(flower);
        }
    }

    private addRocks(group: THREE.Group, radius: number): void {
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
    }

    private addPool(group: THREE.Group): void {
        const pool = new THREE.Mesh(
            new THREE.CylinderGeometry(0.62, 0.62, 0.035, 20),
            new THREE.MeshStandardMaterial({
                color: '#43c8d9',
                transparent: true,
                opacity: 0.82,
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
        group.add(new THREE.PointLight('#ffca7a', 0.55, 3));

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
            color: '#6b665f',
            roughness: 0.95,
            flatShading: true,
        });

        for (let index = 0; index < 18; index += 1) {
            const fragment = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.12 + (index % 4) * 0.05, 0),
                fragmentMaterial,
            );
            fragment.position.set(
                Math.sin(index * 1.9) * 7.6,
                -1.8 - (index % 5) * 0.45,
                Math.cos(index * 1.31) * 5.2,
            );
            fragment.rotation.set(index * 0.17, index * 0.31, index * 0.11);
            this.root.add(fragment);
        }
    }

    private createCloudBands(): void {
        const cloudMaterial = new THREE.MeshBasicMaterial({
            color: '#eff8fb',
            transparent: true,
            opacity: 0.48,
        });

        for (let index = 0; index < 12; index += 1) {
            const cloud = new THREE.Mesh(
                new THREE.SphereGeometry(0.58 + (index % 3) * 0.18, 10, 7),
                cloudMaterial,
            );
            cloud.position.set(
                Math.sin(index * 1.44) * 8.2,
                0.25 - (index % 4) * 0.5,
                Math.cos(index * 1.08) * 5.9,
            );
            cloud.scale.set(1.8, 0.36, 0.72);
            this.root.add(cloud);
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
                Math.sin(index * 12.93) * 8,
                4 - (index % 18) * 0.34,
                Math.cos(index * 8.21) * 6,
            );
            particles.setMatrixAt(index, matrix);
        }

        this.weatherParticles.push(particles);
        this.root.add(particles);
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
        this.loader.load(
            '/assets/salem/salem-cat.glb',
            (gltf) => {
                const model = gltf.scene;
                model.scale.setScalar(0.34);
                model.rotation.y = Math.PI * 0.5;
                model.traverse((object) => {
                    object.castShadow = true;
                    object.receiveShadow = true;
                });
                this.catAnchor.clear();
                this.catAnchor.add(model);
                this.catAnchor.add(this.programmingPaws);
            },
            undefined,
            () => {
                this.options.onAssetError(
                    'Salem model could not load, using fallback cat.',
                );
            },
        );
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
        const frustum = width < 720 ? 9.6 : 8.2;

        this.camera.left = (-frustum * aspect) / 2;
        this.camera.right = (frustum * aspect) / 2;
        this.camera.top = frustum / 2;
        this.camera.bottom = -frustum / 2;
        this.camera.position.set(6.8, 5.6, 8.2);
        this.camera.lookAt(0, -0.15, 0);
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
                    Math.sin(index * 12.93 + elapsed * 0.08) * 8,
                    y,
                    Math.cos(index * 8.21) * 6,
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
