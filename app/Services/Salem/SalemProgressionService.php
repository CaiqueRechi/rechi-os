<?php

namespace App\Services\Salem;

use App\Models\SalemGameSave;
use App\Models\SalemPlayer;
use App\Models\SalemUnlock;
use Illuminate\Support\Carbon;

class SalemProgressionService
{
    /** @var array<string, array{reward: int, cooldown: int}> */
    private const ACTION_RULES = [
        'idle' => ['reward' => 2, 'cooldown' => 15],
        'walk' => ['reward' => 5, 'cooldown' => 20],
        'sit' => ['reward' => 2, 'cooldown' => 20],
        'sleep' => ['reward' => 3, 'cooldown' => 30],
        'inspect' => ['reward' => 7, 'cooldown' => 25],
        'program' => ['reward' => 18, 'cooldown' => 60],
        'dev_cozy_points' => ['reward' => 25, 'cooldown' => 5],
    ];

    public function resolveSave(SalemPlayer $player): SalemGameSave
    {
        return $player->gameSave()->firstOrCreate([], [
            'level' => 1,
            'xp' => 0,
            'cozy_points' => 0,
            'current_biome' => 'main',
            'pet_state' => 'idle',
            'state_payload' => [
                'action_cooldowns' => [],
                'action_counts' => [],
            ],
            'save_version' => 1,
        ]);
    }

    /** @return array{accepted: bool, reward: int, save: array<string, mixed>, next_allowed_at: ?string} */
    public function recordAction(SalemPlayer $player, string $action): array
    {
        $save = $this->resolveSave($player);
        $rules = self::ACTION_RULES[$action];
        $payload = $this->payload($save);
        $now = Carbon::now();
        $nextAllowedAt = $this->nextAllowedAt($payload, $action);

        if ($nextAllowedAt !== null && $now->lessThan($nextAllowedAt)) {
            return [
                'accepted' => false,
                'reward' => 0,
                'save' => $this->serializeSave($save),
                'next_allowed_at' => $nextAllowedAt->toJSON(),
            ];
        }

        $payload['action_cooldowns'][$action] = $now->copy()->addSeconds($rules['cooldown'])->toJSON();
        $payload['action_counts'][$action] = (int) ($payload['action_counts'][$action] ?? 0) + 1;
        $payload['last_action_at'] = $now->toJSON();

        $reward = $rules['reward'];
        $save->forceFill([
            'xp' => $save->xp + $reward,
            'cozy_points' => $save->cozy_points + $reward,
            'level' => intdiv($save->xp + $reward, 100) + 1,
            'pet_state' => $action === 'dev_cozy_points' ? $save->pet_state : $action,
            'state_payload' => $payload,
            'last_progress_at' => $now,
        ])->save();

        $this->syncUnlocks($player, $save);

        return [
            'accepted' => true,
            'reward' => $reward,
            'save' => $this->serializeSave($save->refresh()),
            'next_allowed_at' => $this->nextAllowedAt($payload, $action)?->toJSON(),
        ];
    }

    /** @return array<string, mixed> */
    public function serializeSave(SalemGameSave $save): array
    {
        $save->loadMissing('player.unlocks');

        return [
            'level' => $save->level,
            'xp' => $save->xp,
            'cozy_points' => $save->cozy_points,
            'current_biome' => $save->current_biome,
            'pet_state' => $save->pet_state,
            'state_payload' => $this->payload($save),
            'save_version' => $save->save_version,
            'last_progress_at' => $this->dateTimeToJson($save->getAttribute('last_progress_at')),
            'unlocks' => $this->serializeUnlocks($save->player->unlocks->all()),
        ];
    }

    /** @return array{action_cooldowns: array<string, string>, action_counts: array<string, int>, last_action_at?: string} */
    protected function payload(SalemGameSave $save): array
    {
        $rawPayload = $save->getAttribute('state_payload');
        $payload = [];

        if (is_array($rawPayload)) {
            $payload = $rawPayload;
        }

        if (is_string($rawPayload)) {
            $decodedPayload = json_decode($rawPayload, true);
            $payload = is_array($decodedPayload) ? $decodedPayload : [];
        }

        $cooldowns = $payload['action_cooldowns'] ?? [];
        $counts = $payload['action_counts'] ?? [];

        $payload['action_cooldowns'] = is_array($cooldowns) ? $cooldowns : [];
        $payload['action_counts'] = is_array($counts) ? $counts : [];

        return $payload;
    }

    /** @param array{action_cooldowns: array<string, string>} $payload */
    protected function nextAllowedAt(array $payload, string $action): ?Carbon
    {
        $nextAllowedAt = $payload['action_cooldowns'][$action] ?? null;

        if (! is_string($nextAllowedAt)) {
            return null;
        }

        return Carbon::parse($nextAllowedAt);
    }

    protected function syncUnlocks(SalemPlayer $player, SalemGameSave $save): void
    {
        $milestones = [
            50 => ['atmosphere', 'night_laptop_glow'],
            125 => ['biome', 'misty_rock_isle'],
        ];

        foreach ($milestones as $points => [$type, $key]) {
            if ($save->cozy_points < $points) {
                continue;
            }

            $player->unlocks()->firstOrCreate(
                [
                    'unlock_type' => $type,
                    'unlock_key' => $key,
                ],
                [
                    'metadata' => ['cozy_points_required' => $points],
                    'unlocked_at' => now(),
                ],
            );
        }
    }

    protected function dateTimeToJson(mixed $value): ?string
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value)->toJSON();
    }

    /**
     * @param  array<int, SalemUnlock>  $unlocks
     * @return list<array{type: string, key: string, unlocked_at: ?string}>
     */
    protected function serializeUnlocks(array $unlocks): array
    {
        $serializedUnlocks = [];

        foreach ($unlocks as $unlock) {
            $serializedUnlocks[] = [
                'type' => $unlock->unlock_type,
                'key' => $unlock->unlock_key,
                'unlocked_at' => $this->dateTimeToJson($unlock->getAttribute('unlocked_at')),
            ];
        }

        return $serializedUnlocks;
    }
}
