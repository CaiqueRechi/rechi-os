import type { SalemAction, SalemSave } from '@/types';

export type BehaviorChoice = {
    action: SalemAction;
    reason: string;
};

type WeightedAction = {
    action: SalemAction;
    weight: number;
    reason: string;
};

const weightedActions: WeightedAction[] = [
    { action: 'idle', weight: 18, reason: 'Salem watches the islands drift' },
    { action: 'walk', weight: 24, reason: 'Salem patrols the main island' },
    { action: 'sit', weight: 14, reason: 'Salem settles near the cabin' },
    { action: 'sleep', weight: 10, reason: 'Salem curls up in the grass' },
    { action: 'inspect', weight: 18, reason: 'Salem studies a tiny detail' },
    { action: 'program', weight: 16, reason: 'Salem has code to ship' },
];

export function chooseAutonomousAction(
    save: SalemSave,
    now: Date,
    random: () => number = Math.random,
): BehaviorChoice {
    const availableActions = weightedActions.filter((choice) =>
        isActionAvailable(save, choice.action, now),
    );

    if (availableActions.length === 0) {
        return {
            action: 'idle',
            reason: 'All richer actions are cooling down',
        };
    }

    const totalWeight = availableActions.reduce(
        (total, choice) => total + choice.weight,
        0,
    );
    let cursor = random() * totalWeight;

    for (const choice of availableActions) {
        cursor -= choice.weight;

        if (cursor <= 0) {
            return { action: choice.action, reason: choice.reason };
        }
    }

    return availableActions[availableActions.length - 1];
}

export function isActionAvailable(
    save: SalemSave,
    action: SalemAction,
    now: Date,
): boolean {
    const cooldown = save.state_payload.action_cooldowns[action];

    if (!cooldown) {
        return true;
    }

    return new Date(cooldown).getTime() <= now.getTime();
}
