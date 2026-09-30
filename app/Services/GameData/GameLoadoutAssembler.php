<?php

namespace App\Services\GameData;

class GameLoadoutAssembler
{
    private const ACCESSORY_SLOTS = 5;

    /**
     * @param  list<array<string, mixed>>  $recommendations
     * @param  array<string, mixed>|null  $previous
     * @return array<string, mixed>
     */
    public function assemble(array $recommendations, ?array $previous = null): array
    {
        usort($recommendations, static fn (array $left, array $right): int => (int) ($left['priority'] ?? PHP_INT_MAX) <=> (int) ($right['priority'] ?? PHP_INT_MAX));

        $weapon = $this->firstForRole($recommendations, 'weapon') ?? ($previous['weapon'] ?? null);
        $armor = [
            'head' => $this->firstForRole($recommendations, 'armor_head') ?? ($previous['armor']['head'] ?? null),
            'body' => $this->firstForRole($recommendations, 'armor_body') ?? ($previous['armor']['body'] ?? null),
            'legs' => $this->firstForRole($recommendations, 'armor_legs') ?? ($previous['armor']['legs'] ?? null),
            'other' => $this->forRole($recommendations, 'armor'),
        ];

        $accessories = $this->uniqueItems([
            ...$this->forRole($recommendations, 'accessory'),
            ...$this->previousAccessories($previous),
        ]);
        $accessories = array_slice($accessories, 0, self::ACCESSORY_SLOTS);

        $missing = [];
        if ($weapon === null) {
            $missing[] = 'weapon';
        }
        foreach (['head', 'body', 'legs'] as $slot) {
            if ($armor[$slot] === null) {
                $missing[] = 'armor_'.$slot;
            }
        }
        for ($index = count($accessories); $index < self::ACCESSORY_SLOTS; $index++) {
            $missing[] = 'accessory_'.($index + 1);
        }

        return [
            'weapon' => $weapon,
            'armor' => $armor,
            'accessories' => $accessories,
            'missing_slots' => $missing,
            'completion' => 9 - count($missing),
            'total_slots' => 9,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $recommendations
     * @return array<string, mixed>|null
     */
    private function firstForRole(array $recommendations, string $role): ?array
    {
        return $this->forRole($recommendations, $role)[0] ?? null;
    }

    /**
     * @param  list<array<string, mixed>>  $recommendations
     * @return list<array<string, mixed>>
     */
    private function forRole(array $recommendations, string $role): array
    {
        return array_values(array_filter(
            $recommendations,
            static fn (array $recommendation): bool => ($recommendation['slot_type'] ?? null) === $role && is_array($recommendation['item'] ?? null)
        ));
    }

    /**
     * @param  array<string, mixed>|null  $previous
     * @return list<array<string, mixed>>
     */
    private function previousAccessories(?array $previous): array
    {
        $accessories = $previous['accessories'] ?? [];

        return is_array($accessories) ? array_values(array_filter($accessories, 'is_array')) : [];
    }

    /**
     * @param  list<array<string, mixed>>  $recommendations
     * @return list<array<string, mixed>>
     */
    private function uniqueItems(array $recommendations): array
    {
        $seen = [];

        return array_values(array_filter($recommendations, static function (array $recommendation) use (&$seen): bool {
            $item = $recommendation['item'] ?? null;
            if (! is_array($item)) {
                return false;
            }
            $globalId = (string) ($item['global_id'] ?? '');
            if ($globalId === '' || isset($seen[$globalId])) {
                return false;
            }
            $seen[$globalId] = true;

            return true;
        }));
    }
}
