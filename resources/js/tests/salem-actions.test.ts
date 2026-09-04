import { describe, expect, it } from 'vitest';

import {
    actionDuration,
    salemActionSequences,
    sequenceStepAt,
} from '@/features/salem/state/salem-actions';

describe('salem action sequences', () => {
    it('keeps programming as a multi-step interaction', () => {
        expect(
            salemActionSequences.program.steps.map((step) => step.phase),
        ).toEqual(['moving', 'aligning', 'acting', 'finishing', 'idle']);
        expect(actionDuration('program')).toBeGreaterThan(15000);
    });

    it('returns the active step for elapsed time', () => {
        expect(sequenceStepAt('program', 500).label).toBe('Walking to chair');
        expect(sequenceStepAt('program', 3300).label).toBe('Settling in');
        expect(sequenceStepAt('program', 6000).label).toBe('Programming');
    });
});
