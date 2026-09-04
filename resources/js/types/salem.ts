export type SalemAction =
    'idle' | 'walk' | 'sit' | 'sleep' | 'inspect' | 'program';

export type SalemWeather = 'clear' | 'misty' | 'rain' | 'sunset' | 'night';

export type SalemUnlock = {
    type: string;
    key: string;
    unlocked_at: string | null;
};

export type SalemSave = {
    level: number;
    xp: number;
    cozy_points: number;
    current_biome: string;
    pet_state: SalemAction | string;
    state_payload: {
        action_cooldowns: Record<string, string>;
        action_counts: Record<string, number>;
        last_action_at?: string;
    };
    save_version: number;
    last_progress_at: string | null;
    unlocks: SalemUnlock[];
};

export type SalemActionResponse = {
    accepted: boolean;
    reward: number;
    save: SalemSave;
    next_allowed_at: string | null;
};
