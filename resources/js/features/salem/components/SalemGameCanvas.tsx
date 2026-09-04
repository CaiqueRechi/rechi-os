import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';

import type { SalemAction, SalemWeather } from '@/types';

import { SalemScene } from '../game/scene/SalemScene';
import type { SalemSceneHandle } from '../game/scene/SalemScene';

type SalemGameCanvasProps = {
    weather: SalemWeather;
    onActionChange: (action: SalemAction) => void;
    onAssetError: (message: string) => void;
};

export const SalemGameCanvas = forwardRef<
    SalemSceneHandle,
    SalemGameCanvasProps
>(function SalemGameCanvas({ weather, onActionChange, onAssetError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SalemSceneHandle | null>(null);
    const [webGlUnavailable, setWebGlUnavailable] = useState(false);

    useImperativeHandle(ref, () => {
        return {
            dispose: () => sceneRef.current?.dispose(),
            forceAction: (action) => sceneRef.current?.forceAction(action),
            resetPosition: () => sceneRef.current?.resetPosition(),
            setWeather: (nextWeather) =>
                sceneRef.current?.setWeather(nextWeather),
        };
    });

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        if (!supportsWebGl()) {
            setWebGlUnavailable(true);

            return;
        }

        const scene = new SalemScene(container, {
            onActionChange,
            onAssetError,
        });
        sceneRef.current = scene;

        return () => {
            scene.dispose();
            sceneRef.current = null;
        };
    }, [onActionChange, onAssetError]);

    useEffect(() => {
        sceneRef.current?.setWeather(weather);
    }, [weather]);

    return (
        <div ref={containerRef} className="absolute inset-0">
            {webGlUnavailable ? (
                <div className="grid size-full place-items-center bg-sky-950 px-6 text-center text-white">
                    <div className="max-w-md rounded-lg border border-white/20 bg-white/10 p-5 backdrop-blur">
                        <h1 className="text-xl font-semibold">
                            Salem needs WebGL to open the isles
                        </h1>
                        <p className="mt-2 text-sm text-cyan-50/80">
                            Try a browser with hardware acceleration enabled.
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
});

function supportsWebGl(): boolean {
    const canvas = document.createElement('canvas');

    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
}
