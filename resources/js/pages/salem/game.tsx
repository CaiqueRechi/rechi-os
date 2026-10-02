import { Head } from '@inertiajs/react';
import { ShoppingBag } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
    recordSalemAction,
    tradeSalemItem,
} from '@/features/salem/api/salem-api';
import { SalemGameCanvas } from '@/features/salem/components/SalemGameCanvas';
import { SalemHud } from '@/features/salem/components/SalemHud';
import { SalemMarketPanel } from '@/features/salem/components/SalemMarketPanel';
import type { SalemSceneHandle } from '@/features/salem/game/scene/SalemScene';
import { chooseAutonomousAction } from '@/features/salem/state/behavior-controller';
import type {
    SalemAction,
    SalemMarketItem,
    SalemSave,
    SalemWeather,
} from '@/types';

type SalemPageProps = {
    initialSave: SalemSave;
    market: SalemMarketItem[];
    access: {
        level: 'none' | 'read' | 'write';
        canWrite: boolean;
    };
};

export default function SalemGamePage({
    initialSave,
    market,
    access,
}: SalemPageProps) {
    const sceneRef = useRef<SalemSceneHandle | null>(null);
    const [save, setSave] = useState(initialSave);
    const [action, setAction] = useState<SalemAction>('idle');
    const [weather, setWeather] = useState<SalemWeather>('sunset');
    const [error, setError] = useState<string | null>(null);
    const [marketOpen, setMarketOpen] = useState(false);
    const [marketItems, setMarketItems] = useState(market);
    const [marketMessage, setMarketMessage] = useState<string | null>(null);
    const [busyItemId, setBusyItemId] = useState<number | null>(null);

    const submitAction = useCallback(
        async (nextAction: SalemAction) => {
            if (!access.canWrite) {
                return;
            }

            try {
                const response = await recordSalemAction(nextAction);
                setSave(response.save);
                setError(null);
            } catch {
                setError(
                    'Progress could not be saved. The world is still playable.',
                );
            }
        },
        [access.canWrite],
    );

    const handleTrade = useCallback(
        async (item: SalemMarketItem, tradeAction: 'buy' | 'sell') => {
            if (!access.canWrite) {
                return;
            }

            setBusyItemId(item.id);

            try {
                const response = await tradeSalemItem(item.id, tradeAction);
                setSave(response.save);
                setMarketItems((current) =>
                    current.map((candidate) =>
                        candidate.id === response.item.id
                            ? response.item
                            : candidate,
                    ),
                );
                setMarketMessage(response.message);
                setError(null);
            } catch (tradeError) {
                setMarketMessage(
                    tradeError instanceof Error
                        ? tradeError.message
                        : 'Não foi possível concluir a negociação.',
                );
            } finally {
                setBusyItemId(null);
            }
        },
        [access.canWrite],
    );

    const requestAction = useCallback(
        (nextAction: SalemAction) => {
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
                    onActionRequest={requestAction}
                    onAssetError={setError}
                    onWeatherChange={setWeather}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(18,27,46,0)_32%,rgba(15,23,42,0.34))]" />
                <SalemHud
                    action={action}
                    error={error}
                    save={save}
                    weather={weather}
                />
                <button
                    type="button"
                    onClick={() => setMarketOpen(true)}
                    className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-white/25 bg-[#172033]/65 px-4 py-3 text-sm font-bold text-white shadow-xl backdrop-blur-md transition hover:bg-[#172033]/80 sm:top-5 sm:right-5"
                >
                    <ShoppingBag className="size-4" /> Mercado
                </button>
                <SalemMarketPanel
                    open={marketOpen}
                    items={marketItems}
                    balance={save.cozy_points}
                    canWrite={access.canWrite}
                    busyItemId={busyItemId}
                    message={marketMessage}
                    onClose={() => setMarketOpen(false)}
                    onTrade={(item, tradeAction) =>
                        void handleTrade(item, tradeAction)
                    }
                />
            </main>
        </>
    );
}
