import { Head } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { recordSalemAction } from '@/features/salem/api/salem-api';
import { SalemDevControls } from '@/features/salem/components/SalemDevControls';
import { SalemGameCanvas } from '@/features/salem/components/SalemGameCanvas';
import { SalemHud } from '@/features/salem/components/SalemHud';
import type { SalemSceneHandle } from '@/features/salem/game/scene/SalemScene';
import { chooseAutonomousAction } from '@/features/salem/state/behavior-controller';
import type { SalemAction, SalemSave, SalemWeather } from '@/types';

type SalemPageProps = {
    initialSave: SalemSave;
};

export default function SalemPage({ initialSave }: SalemPageProps) {
    const sceneRef = useRef<SalemSceneHandle | null>(null);
    const [save, setSave] = useState(initialSave);
    const [action, setAction] = useState<SalemAction>('idle');
    const [weather, setWeather] = useState<SalemWeather>('sunset');
    const [error, setError] = useState<string | null>(null);

    const submitAction = useCallback(
        async (nextAction: SalemAction | 'dev_cozy_points') => {
            try {
                const response = await recordSalemAction(nextAction);
                setSave(response.save);
                setError(
                    response.accepted
                        ? null
                        : 'That action is still cooling down.',
                );
            } catch {
                setError(
                    'Progress could not be saved. The world is still playable.',
                );
            }
        },
        [],
    );

    const forceAction = useCallback(
        (nextAction: SalemAction) => {
            sceneRef.current?.forceAction(nextAction);
            setAction(nextAction);
            void submitAction(nextAction);
        },
        [submitAction],
    );

    useEffect(() => {
        const interval = window.setInterval(() => {
            const choice = chooseAutonomousAction(save, new Date());
            sceneRef.current?.forceAction(choice.action);
            setAction(choice.action);
            void submitAction(choice.action);
        }, 14000);

        return () => window.clearInterval(interval);
    }, [save, submitAction]);

    return (
        <>
            <Head title="Salem Floating Isles" />
            <main className="relative h-dvh min-h-[34rem] overflow-hidden bg-[#6d8faf]">
                <SalemGameCanvas
                    ref={sceneRef}
                    weather={weather}
                    onActionChange={setAction}
                    onAssetError={setError}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(18,27,46,0)_32%,rgba(15,23,42,0.34))]" />
                <SalemHud
                    action={action}
                    error={error}
                    save={save}
                    weather={weather}
                />
                <SalemDevControls
                    weather={weather}
                    onAction={forceAction}
                    onAddCurrency={() => void submitAction('dev_cozy_points')}
                    onReset={() => sceneRef.current?.resetPosition()}
                    onWeatherChange={setWeather}
                />
            </main>
        </>
    );
}
