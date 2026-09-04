import type { SalemAction, SalemSave, SalemWeather } from '@/types';

import { weatherPresets } from '../environment/weather';
import { salemActionLabels } from '../state/salem-actions';

type SalemHudProps = {
    action: SalemAction;
    save: SalemSave;
    weather: SalemWeather;
    error: string | null;
};

export function SalemHud({ action, save, weather, error }: SalemHudProps) {
    return (
        <div className="pointer-events-none absolute top-4 left-4 z-10 grid gap-2 text-white drop-shadow-[0_2px_10px_rgba(26,32,44,0.35)] sm:top-6 sm:left-6">
            <div className="rounded-lg border border-white/20 bg-slate-950/35 px-4 py-3 shadow-2xl shadow-slate-950/20 backdrop-blur-md">
                <p className="text-xs tracking-[0.22em] text-cyan-100/80 uppercase">
                    Salem Floating Isles
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-4">
                    <p className="text-2xl font-semibold">
                        {salemActionLabels[action]}
                    </p>
                    <p className="text-sm text-cyan-50/90">
                        {save.cozy_points} Cozy Points
                    </p>
                    <p className="text-sm text-cyan-50/90">
                        Level {save.level}
                    </p>
                </div>
                <p className="mt-1 text-xs text-cyan-50/75">
                    {weatherPresets[weather].label}
                </p>
            </div>
            {error ? (
                <div className="max-w-sm rounded-lg border border-amber-200/40 bg-amber-950/50 px-4 py-2 text-sm text-amber-50 backdrop-blur-md">
                    {error}
                </div>
            ) : null}
        </div>
    );
}
