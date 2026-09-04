import type { SalemAction } from '@/types';

export type SalemActionPhase =
    'idle' | 'moving' | 'aligning' | 'acting' | 'finishing';

export type SalemActionStep = {
    phase: SalemActionPhase;
    durationMs: number;
    label: string;
};

export type SalemActionSequence = {
    action: SalemAction;
    steps: SalemActionStep[];
};

export const salemActionLabels: Record<SalemAction, string> = {
    idle: 'Idle',
    walk: 'Walking',
    sit: 'Sitting',
    sleep: 'Sleeping',
    inspect: 'Inspecting',
    program: 'Programming',
};

export const salemActionSequences: Record<SalemAction, SalemActionSequence> = {
    idle: {
        action: 'idle',
        steps: [{ phase: 'idle', durationMs: 6000, label: 'Idle' }],
    },
    walk: {
        action: 'walk',
        steps: [
            { phase: 'moving', durationMs: 3200, label: 'Walking' },
            { phase: 'idle', durationMs: 1400, label: 'Idle' },
        ],
    },
    sit: {
        action: 'sit',
        steps: [
            { phase: 'moving', durationMs: 1800, label: 'Finding a spot' },
            { phase: 'acting', durationMs: 4200, label: 'Sitting' },
        ],
    },
    sleep: {
        action: 'sleep',
        steps: [
            { phase: 'moving', durationMs: 2200, label: 'Curling up' },
            { phase: 'acting', durationMs: 7000, label: 'Sleeping' },
        ],
    },
    inspect: {
        action: 'inspect',
        steps: [
            { phase: 'moving', durationMs: 2400, label: 'Exploring' },
            { phase: 'acting', durationMs: 4800, label: 'Inspecting' },
        ],
    },
    program: {
        action: 'program',
        steps: [
            { phase: 'moving', durationMs: 2600, label: 'Walking to chair' },
            { phase: 'aligning', durationMs: 1200, label: 'Settling in' },
            { phase: 'acting', durationMs: 9000, label: 'Programming' },
            { phase: 'finishing', durationMs: 1800, label: 'Closing laptop' },
            { phase: 'idle', durationMs: 1200, label: 'Idle' },
        ],
    },
};

export function actionDuration(action: SalemAction): number {
    return salemActionSequences[action].steps.reduce(
        (total, step) => total + step.durationMs,
        0,
    );
}

export function sequenceStepAt(
    action: SalemAction,
    elapsedMs: number,
): SalemActionStep {
    const sequence = salemActionSequences[action];
    let cursor = 0;

    for (const step of sequence.steps) {
        cursor += step.durationMs;

        if (elapsedMs <= cursor) {
            return step;
        }
    }

    return sequence.steps[sequence.steps.length - 1];
}
