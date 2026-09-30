<?php

namespace Tests\Unit;

use App\Services\GameData\GameLoadoutAssembler;
use PHPUnit\Framework\TestCase;

class GameLoadoutAssemblerTest extends TestCase
{
    public function test_it_builds_and_carries_a_complete_equipment_snapshot(): void
    {
        $assembler = new GameLoadoutAssembler;
        $first = $assembler->assemble([
            $this->recommendation('weapon', 'sword', 1),
            $this->recommendation('armor_head', 'helmet', 1),
            $this->recommendation('accessory', 'boots', 1),
            $this->recommendation('accessory', 'shield', 2),
        ]);

        $this->assertSame('sword', $first['weapon']['item']['global_id']);
        $this->assertSame('helmet', $first['armor']['head']['item']['global_id']);
        $this->assertCount(2, $first['accessories']);
        $this->assertContains('armor_body', $first['missing_slots']);

        $second = $assembler->assemble([
            $this->recommendation('armor_body', 'chestplate', 1),
            $this->recommendation('armor_legs', 'greaves', 1),
            $this->recommendation('accessory', 'wings', 1),
        ], $first);

        $this->assertSame('sword', $second['weapon']['item']['global_id']);
        $this->assertSame('helmet', $second['armor']['head']['item']['global_id']);
        $this->assertSame('chestplate', $second['armor']['body']['item']['global_id']);
        $this->assertSame('greaves', $second['armor']['legs']['item']['global_id']);
        $this->assertSame(['wings', 'boots', 'shield'], array_map(
            static fn (array $entry): string => (string) $entry['item']['global_id'],
            $second['accessories']
        ));
        $this->assertSame(7, $second['completion']);
    }

    /** @return array<string, mixed> */
    private function recommendation(string $slot, string $globalId, int $priority): array
    {
        return [
            'slot_type' => $slot,
            'priority' => $priority,
            'item' => ['global_id' => $globalId, 'display_name' => ucfirst($globalId)],
        ];
    }
}
