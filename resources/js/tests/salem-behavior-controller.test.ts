import { describe, expect, it } from 'vitest';

import { chooseAutonomousAction } from '@/features/salem/state/behavior-controller';
import type { SalemSave } from '@/types';

const baseSave: SalemSave = {
    level: 1,
    xp: 0,
    cozy_points: 0,
    current_biome: 'main',
    pet_state: 'idle',
    state_payload: {
        action_cooldowns: {},
        action_counts: {},
    },
    save_version: 1,
    last_progress_at: null,
    unlocks: [],
};

describe('salem behavior controller', () => {
    it('uses weighted choices when actions are available', () => {
        const choice = chooseAutonomousAction(
            baseSave,
            new Date('2026-09-04T12:00:00.000Z'),
            () => 0.99,
        );

        expect(choice.action).toBe('program');
    });

    it('falls back to idle when every richer action is cooling down', () => {
        const save: SalemSave = {
            ...baseSave,
            state_payload: {
                action_counts: {},
                action_cooldowns: {
                    idle: '2026-09-04T12:01:00.000Z',
                    walk: '2026-09-04T12:01:00.000Z',
                    sit: '2026-09-04T12:01:00.000Z',
                    sleep: '2026-09-04T12:01:00.000Z',
                    inspect: '2026-09-04T12:01:00.000Z',
                    program: '2026-09-04T12:01:00.000Z',
                },
            },
        };

        const choice = chooseAutonomousAction(
            save,
            new Date('2026-09-04T12:00:00.000Z'),
            () => 0,
        );

        expect(choice.action).toBe('idle');
    });
});
