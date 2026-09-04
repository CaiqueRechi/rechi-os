import { ChevronDown, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { SalemAction, SalemWeather } from '@/types';

import { weatherPresets } from '../environment/weather';
import { salemActionLabels } from '../state/salem-actions';

type SalemDevControlsProps = {
    onAction: (action: SalemAction) => void;
    onAddCurrency: () => void;
    onReset: () => void;
    onWeatherChange: (weather: SalemWeather) => void;
    weather: SalemWeather;
};

const actions: SalemAction[] = [
    'idle',
    'walk',
    'sit',
    'sleep',
    'program',
    'inspect',
];

const weatherOptions = Object.keys(weatherPresets) as SalemWeather[];

export function SalemDevControls({
    onAction,
    onAddCurrency,
    onReset,
    onWeatherChange,
    weather,
}: SalemDevControlsProps) {
    const [open, setOpen] = useState(false);

    return (
        <div className="absolute right-4 bottom-4 z-10 w-[min(92vw,21rem)] rounded-md border border-white/18 bg-[#151d31]/50 text-white shadow-2xl shadow-slate-950/20 backdrop-blur-md sm:right-5 sm:bottom-5">
            <button
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-semibold tracking-[0.14em] text-cyan-50/90 uppercase"
                type="button"
                onClick={() => setOpen((value) => !value)}
            >
                Controls
                <ChevronDown
                    aria-hidden="true"
                    className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open ? (
                <div className="grid gap-3 border-t border-white/12 p-4">
                    <div className="grid grid-cols-3 gap-2">
                        {actions.map((action) => (
                            <button
                                key={action}
                                className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-white/20"
                                type="button"
                                onClick={() => onAction(action)}
                            >
                                {salemActionLabels[action]}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200/30 bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-50 transition hover:bg-emerald-500/30"
                            type="button"
                            onClick={onAddCurrency}
                        >
                            <Sparkles aria-hidden="true" className="size-4" />
                            Add Cozy Points
                        </button>
                        <button
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-cyan-50 transition hover:bg-white/20"
                            type="button"
                            onClick={onReset}
                        >
                            <RotateCcw aria-hidden="true" className="size-4" />
                            Reset Position
                        </button>
                    </div>
                    <label className="grid gap-1 text-xs tracking-[0.16em] text-cyan-100/75 uppercase">
                        Weather
                        <select
                            className="rounded-md border border-white/15 bg-slate-950/70 px-3 py-2 text-sm tracking-normal text-white normal-case"
                            value={weather}
                            onChange={(event) =>
                                onWeatherChange(
                                    event.target.value as SalemWeather,
                                )
                            }
                        >
                            {weatherOptions.map((option) => (
                                <option key={option} value={option}>
                                    {weatherPresets[option].label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            ) : null}
        </div>
    );
}
