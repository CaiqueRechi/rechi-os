<?php

namespace App\Services\GameData;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class GameReforgeService
{
    /** @return list<array<string, int|float|string>> */
    public function definitions(): array
    {
        return [
            ['key' => 'hard', 'name' => 'Hard', 'tier' => 1, 'defense' => 1],
            ['key' => 'guarding', 'name' => 'Guarding', 'tier' => 2, 'defense' => 2],
            ['key' => 'armored', 'name' => 'Armored', 'tier' => 3, 'defense' => 3],
            ['key' => 'warding', 'name' => 'Warding', 'tier' => 4, 'defense' => 4],
            ['key' => 'jagged', 'name' => 'Jagged', 'tier' => 1, 'damage' => 1],
            ['key' => 'spiked', 'name' => 'Spiked', 'tier' => 2, 'damage' => 2],
            ['key' => 'angry', 'name' => 'Angry', 'tier' => 3, 'damage' => 3],
            ['key' => 'menacing', 'name' => 'Menacing', 'tier' => 4, 'damage' => 4],
            ['key' => 'precise', 'name' => 'Precise', 'tier' => 2, 'critical' => 2],
            ['key' => 'lucky', 'name' => 'Lucky', 'tier' => 4, 'critical' => 4],
            ['key' => 'brisk', 'name' => 'Brisk', 'tier' => 1, 'movement' => 1],
            ['key' => 'fleeting', 'name' => 'Fleeting', 'tier' => 2, 'movement' => 2],
            ['key' => 'hasty', 'name' => 'Hasty', 'tier' => 3, 'movement' => 3],
            ['key' => 'quick', 'name' => 'Quick', 'tier' => 4, 'movement' => 4],
            ['key' => 'wild', 'name' => 'Wild', 'tier' => 1, 'melee_speed' => 1],
            ['key' => 'rash', 'name' => 'Rash', 'tier' => 2, 'melee_speed' => 2],
            ['key' => 'intrepid', 'name' => 'Intrepid', 'tier' => 3, 'melee_speed' => 3],
            ['key' => 'violent', 'name' => 'Violent', 'tier' => 4, 'melee_speed' => 4],
            ['key' => 'arcane', 'name' => 'Arcane', 'tier' => 4, 'mana' => 20],
        ];
    }

    public function sync(): void
    {
        if (! Schema::hasTable('game_reforge_profiles')) {
            return;
        }

        $now = now();
        foreach ($this->definitions() as $definition) {
            $defense = (float) ($definition['defense'] ?? 0);
            $damage = (float) ($definition['damage'] ?? 0);
            $critical = (float) ($definition['critical'] ?? 0);
            $movement = (float) ($definition['movement'] ?? 0);
            $meleeSpeed = (float) ($definition['melee_speed'] ?? 0);
            $mana = (float) ($definition['mana'] ?? 0);
            DB::table('game_reforge_profiles')->updateOrInsert(
                ['game_key' => 'terraria', 'reforge_key' => $definition['key']],
                [
                    'name' => $definition['name'],
                    'item_type' => 'accessory',
                    'tier' => $definition['tier'],
                    'defense_bonus' => $defense,
                    'damage_percent' => $damage,
                    'critical_chance_percent' => $critical,
                    'movement_speed_percent' => $movement,
                    'melee_speed_percent' => $meleeSpeed,
                    'mana_bonus' => $mana,
                    'score_vector_json' => json_encode([
                        'defense' => $defense * 5,
                        'damage' => $damage + $critical + $meleeSpeed,
                        'utility' => $movement + $mana / 5,
                    ], JSON_THROW_ON_ERROR),
                    'metadata_json' => json_encode(['source' => 'terraria_accessory_prefix'], JSON_THROW_ON_ERROR),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }

    /** @return list<array<string, mixed>> */
    public function recommendForAccessories(int $count, int $balance): array
    {
        if ($count <= 0) {
            return [];
        }

        $balance = max(-100, min(100, $balance));
        $damageSlots = (int) round((($balance + 100) / 200) * $count);
        $defenseSlots = $count - $damageSlots;
        $keys = [
            ...array_fill(0, $defenseSlots, 'warding'),
            ...array_fill(0, $damageSlots, 'menacing'),
        ];

        if (abs($balance) <= 25 && $count >= 3) {
            $middle = (int) floor($count / 2);
            $keys[$middle] = 'lucky';
        }

        $definitions = collect($this->definitions())->keyBy('key');

        return array_values(array_map(static function (string $key) use ($definitions): array {
            $definition = (array) $definitions->get($key, []);

            return [
                'key' => $key,
                'name' => (string) ($definition['name'] ?? $key),
                'defense_bonus' => (float) ($definition['defense'] ?? 0),
                'damage_percent' => (float) ($definition['damage'] ?? 0),
                'critical_chance_percent' => (float) ($definition['critical'] ?? 0),
            ];
        }, $keys));
    }
}
