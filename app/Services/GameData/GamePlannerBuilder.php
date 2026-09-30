<?php

namespace App\Services\GameData;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class GamePlannerBuilder
{
    private const ALGORITHM_VERSION = 'availability-power-v1';

    private const MAX_PROGRESS_RANK = 3000;

    /** @return array<string, int|string> */
    public function build(string $trackKey): array
    {
        $this->assertReady();

        $track = DB::table('game_progression_tracks')->where('track_key', $trackKey)->first();
        if (! $track) {
            throw new RuntimeException("Unknown progression track: {$trackKey}");
        }

        $trackData = (array) $track;
        $trackMetadata = $this->decodeJson($trackData['metadata_json'] ?? null);
        $tierCount = max(6, min(30, (int) ($trackMetadata['tiers_per_phase'] ?? 6) * 3));
        $recommendationLimit = max(1, min(10, (int) ($trackMetadata['recommendations_per_slot'] ?? 5)));
        $minimumUpgrade = max(0.0, (float) ($trackMetadata['minimum_upgrade_percent'] ?? 8) / 100);

        $items = $this->loadItemFacts();
        $bosses = $this->loadBossRanks($items);
        $dropMethods = $this->loadDropMethods($bosses);
        $recipes = $this->loadRecipes();
        $availability = $this->deriveAvailability($items, $dropMethods, $recipes);
        $milestones = $this->deriveMilestones($items, $availability, $tierCount);
        $archetypes = DB::table('game_build_archetypes')->where('game_key', (string) $trackData['game_key'])
            ->where('is_active', true)
            ->orderBy('sort_order')->orderBy('name')->get();

        $result = DB::transaction(function () use (
            $trackData,
            $items,
            $availability,
            $milestones,
            $archetypes,
            $recommendationLimit,
            $minimumUpgrade
        ): array {
            $trackId = (int) $trackData['id'];
            $archetypeIds = array_values($archetypes->pluck('id')
                ->map(static fn (mixed $id): int => (int) $id)->all());
            $this->clearGeneratedData($trackId, $archetypeIds);
            $milestoneIds = $this->storeMilestones($trackId, $milestones);
            $this->storeAvailability($trackId, $items, $availability, $milestones, $milestoneIds);

            $plannerCount = 0;
            $plannerItemCount = 0;
            $classifiedCount = 0;

            foreach ($archetypes as $archetype) {
                $archetypeData = (array) $archetype;
                $candidates = $this->candidatesForArchetype($items, $availability, $archetypeData);
                $classifiedCount += $this->storeItemArchetypes((int) $archetypeData['id'], $candidates);
                $plannerItemCount += $this->storePlanner(
                    $trackId,
                    $archetypeData,
                    $candidates,
                    $milestones,
                    $milestoneIds,
                    $recommendationLimit,
                    $minimumUpgrade
                );
                $plannerCount++;
            }

            return [
                'track' => (string) $trackData['track_key'],
                'algorithm' => self::ALGORITHM_VERSION,
                'items_analyzed' => count($items),
                'items_with_known_availability' => count(array_filter(
                    $availability,
                    static fn (array $row): bool => $row['confidence'] !== 'unknown'
                )),
                'generated_milestones' => count($milestones),
                'generated_planners' => $plannerCount,
                'classified_items' => $classifiedCount,
                'planner_recommendations' => $plannerItemCount,
            ];
        });

        return $result;
    }

    private function assertReady(): void
    {
        foreach (['game_progression_tracks', 'game_build_archetypes', 'game_planners'] as $table) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException('Planner tables are not installed. Run migrations first.');
            }
        }

        $catalogSchema = Schema::connection((string) config('game-data.connection', config('database.default')));
        foreach ([
            'items', 'mods', 'item_stats', 'item_properties', 'categories', 'item_categories', 'combat_classes',
            'item_combat_classes', 'tags', 'item_tags', 'progression_stages', 'item_progression', 'recipes',
            'recipe_ingredients', 'recipe_group_members', 'drops', 'npcs', 'npc_stats', 'bosses',
        ] as $table) {
            if (! $catalogSchema->hasTable($table)) {
                throw new RuntimeException("The catalog table {$table} is not installed.");
            }
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function loadItemFacts(): array
    {
        $db = $this->catalogDatabase();
        $items = [];

        foreach ($db->table('items as i')->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->get([
                'i.id', 'i.global_id', 'i.display_name', 'i.tooltip', 'i.description', 'i.rarity_text',
                'i.raw_json', 'm.mod_key',
            ]) as $item) {
            $row = (array) $item;
            $id = (int) $row['id'];
            $items[$id] = [
                ...$row,
                'id' => $id,
                'stats' => [],
                'categories' => [],
                'classes' => [],
                'properties' => [],
                'tags' => [],
                'floor_rank' => 0,
                'has_declared_availability' => false,
            ];
        }

        foreach ($db->table('item_stats')->get(['item_id', 'stat_key', 'numeric_value', 'text_value', 'raw_value']) as $stat) {
            $row = (array) $stat;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['stats'][(string) $row['stat_key']] = $row['numeric_value'] ?? $row['text_value'] ?? $row['raw_value'];
            }
        }
        foreach ($db->table('item_categories as ic')->join('categories as c', 'c.id', '=', 'ic.category_id')
            ->get(['ic.item_id', 'c.category_key']) as $category) {
            $row = (array) $category;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['categories'][] = (string) $row['category_key'];
            }
        }
        foreach ($db->table('item_combat_classes as icc')->join('combat_classes as cc', 'cc.id', '=', 'icc.combat_class_id')
            ->get(['icc.item_id', 'cc.class_key']) as $class) {
            $row = (array) $class;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['classes'][] = (string) $row['class_key'];
            }
        }
        foreach ($db->table('item_properties')->get([
            'item_id', 'property_key', 'boolean_value', 'numeric_value', 'text_value', 'raw_value',
        ]) as $property) {
            $row = (array) $property;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['properties'][(string) $row['property_key']] = $row['boolean_value']
                    ?? $row['numeric_value'] ?? $row['text_value'] ?? $row['raw_value'];
            }
        }
        foreach ($db->table('item_tags as it')->join('tags as t', 't.id', '=', 'it.tag_id')
            ->get(['it.item_id', 't.tag_key']) as $tag) {
            $row = (array) $tag;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['tags'][] = (string) $row['tag_key'];
            }
        }
        foreach ($db->table('item_progression as ip')->join('progression_stages as ps', 'ps.id', '=', 'ip.progression_stage_id')
            ->get(['ip.item_id', 'ps.sort_order']) as $progression) {
            $row = (array) $progression;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['has_declared_availability'] = true;
                $items[$itemId]['floor_rank'] = max(
                    (int) $items[$itemId]['floor_rank'],
                    max(0, ((int) $row['sort_order'] - 100) * 10)
                );
            }
        }

        foreach ($items as &$item) {
            if (in_array('hardmode', $item['tags'], true) || in_array('hardmodeonly', $item['tags'], true)) {
                $item['floor_rank'] = max(1000, (int) $item['floor_rank']);
            }
            $raw = strtolower((string) ($item['raw_json'] ?? ''));
            if (str_contains($raw, 'post-moon lord') || str_contains($raw, 'post moon lord')) {
                $item['floor_rank'] = max(2000, (int) $item['floor_rank']);
            }
        }
        unset($item);

        return $items;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return array<int, array{rank: int, name: string, score: float}>
     */
    private function loadBossRanks(array $items): array
    {
        $db = $this->catalogDatabase();
        $bosses = [];
        $rows = $db->table('bosses as b')->join('npcs as n', 'n.id', '=', 'b.npc_id')
            ->leftJoin('npc_stats as life', function ($join): void {
                $join->on('life.npc_id', '=', 'n.id')->where('life.stat_key', 'life');
            })->leftJoin('npc_stats as damage', function ($join): void {
                $join->on('damage.npc_id', '=', 'n.id')->where('damage.stat_key', 'damage');
            })->leftJoin('npc_stats as defense', function ($join): void {
                $join->on('defense.npc_id', '=', 'n.id')->where('defense.stat_key', 'defense');
            })->get([
                'n.id', 'n.display_name', 'life.numeric_value as life', 'damage.numeric_value as damage',
                'defense.numeric_value as defense',
            ]);

        $combatScores = [];
        foreach ($rows as $boss) {
            $row = (array) $boss;
            $life = max(1.0, (float) ($row['life'] ?? 1));
            $score = log10($life + 1) * 100 + (float) ($row['damage'] ?? 0) + (float) ($row['defense'] ?? 0) * 2;
            $combatScores[] = $score;
            $bosses[(int) $row['id']] = ['rank' => 0, 'name' => (string) $row['display_name'], 'score' => $score];
        }

        $bossFloorRanks = [];
        $bossDropPower = [];
        foreach ($db->table('drops')->whereNotNull('npc_id')->whereNotNull('item_id')->get(['npc_id', 'item_id']) as $drop) {
            $row = (array) $drop;
            $npcId = (int) $row['npc_id'];
            $itemId = (int) $row['item_id'];
            if (isset($bosses[$npcId], $items[$itemId])) {
                $bossFloorRanks[$npcId] = max($bossFloorRanks[$npcId] ?? 0, (int) $items[$itemId]['floor_rank']);
                if ((float) ($items[$itemId]['stats']['damage'] ?? 0) > 0) {
                    $bossDropPower[$npcId] = max(
                        $bossDropPower[$npcId] ?? 0.0,
                        $this->powerScore($items[$itemId], 'weapon', '')
                    );
                }
            }
        }

        sort($combatScores, SORT_NUMERIC);
        $dropPowerScores = array_values($bossDropPower);
        sort($dropPowerScores, SORT_NUMERIC);
        $combatCount = count($combatScores);
        $dropPowerCount = count($dropPowerScores);
        foreach ($bosses as $npcId => &$boss) {
            $combatPosition = $this->lowerBound($combatScores, $boss['score']);
            $combatPercentile = $combatCount <= 1 ? 0.0 : $combatPosition / ($combatCount - 1);
            $dropPercentile = 0.0;
            if (isset($bossDropPower[$npcId])) {
                $dropPosition = $this->lowerBound($dropPowerScores, $bossDropPower[$npcId]);
                $dropPercentile = $dropPowerCount <= 1 ? 0.0 : $dropPosition / ($dropPowerCount - 1);
            }
            $percentile = max($combatPercentile, $dropPercentile);
            $boss['rank'] = max(
                $bossFloorRanks[$npcId] ?? 0,
                100 + (int) round($percentile * (self::MAX_PROGRESS_RANK - 100))
            );
        }
        unset($boss);

        return $bosses;
    }

    /**
     * @param  array<int, array{rank: int, name: string, score: float}>  $bosses
     * @return array<int, list<array{rank: int, type: string, confidence: string, source_item_id: int|null}>>
     */
    private function loadDropMethods(array $bosses): array
    {
        $methods = [];
        foreach ($this->catalogDatabase()->table('drops')->whereNotNull('item_id')
            ->get(['item_id', 'npc_id', 'source_item_id', 'source_type', 'condition_text', 'conditions_json']) as $drop) {
            $row = (array) $drop;
            $rank = 0;
            $npcId = $row['npc_id'] === null ? null : (int) $row['npc_id'];
            if ($npcId !== null && isset($bosses[$npcId])) {
                $rank = $bosses[$npcId]['rank'];
            } else {
                $condition = strtolower((string) ($row['condition_text'] ?? '').' '.(string) ($row['conditions_json'] ?? ''));
                if (str_contains($condition, 'moon lord')) {
                    $rank = 2000;
                } elseif (str_contains($condition, 'hardmode')) {
                    $rank = 1000;
                }
                foreach ($bosses as $boss) {
                    if (str_contains($condition, strtolower($boss['name']))) {
                        $rank = max($rank, $boss['rank']);
                    }
                }
            }
            $methods[(int) $row['item_id']][] = [
                'rank' => $rank,
                'type' => (string) $row['source_type'],
                'confidence' => 'derived',
                'source_item_id' => $row['source_item_id'] === null ? null : (int) $row['source_item_id'],
            ];
        }

        return $methods;
    }

    /** @return array<int, list<list<list<int>>>> */
    private function loadRecipes(): array
    {
        $db = $this->catalogDatabase();
        $recipes = [];
        $rows = $db->table('recipes')->whereNotNull('result_item_id')->where('is_historical', false)
            ->get(['id', 'result_item_id']);
        $recipeResults = [];
        foreach ($rows as $recipe) {
            $row = (array) $recipe;
            $recipeResults[(int) $row['id']] = (int) $row['result_item_id'];
        }
        $groupMembers = [];
        foreach ($db->table('recipe_group_members')->get(['recipe_group_id', 'item_id']) as $member) {
            $row = (array) $member;
            $groupMembers[(int) $row['recipe_group_id']][] = (int) $row['item_id'];
        }

        $ingredients = [];
        $invalidRecipes = [];
        foreach ($db->table('recipe_ingredients')->whereIn('recipe_id', array_keys($recipeResults))
            ->get(['recipe_id', 'ingredient_item_id', 'recipe_group_id', 'unresolved_name']) as $ingredient) {
            $row = (array) $ingredient;
            $recipeId = (int) $row['recipe_id'];
            if ($row['ingredient_item_id'] !== null) {
                $ingredients[$recipeId][] = [(int) $row['ingredient_item_id']];

                continue;
            }

            $groupId = $row['recipe_group_id'] === null ? null : (int) $row['recipe_group_id'];
            if ($groupId !== null && ($groupMembers[$groupId] ?? []) !== []) {
                $ingredients[$recipeId][] = $groupMembers[$groupId];
            } else {
                $invalidRecipes[$recipeId] = true;
            }
        }
        foreach ($recipeResults as $recipeId => $resultItemId) {
            if (! isset($invalidRecipes[$recipeId]) && ($ingredients[$recipeId] ?? []) !== []) {
                $recipes[$resultItemId][] = $ingredients[$recipeId];
            }
        }

        return $recipes;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, list<array{rank: int, type: string, confidence: string, source_item_id: int|null}>>  $dropMethods
     * @param  array<int, list<list<list<int>>>>  $recipes
     * @return array<int, array{rank: int, type: string, confidence: string}>
     */
    private function deriveAvailability(array $items, array $dropMethods, array $recipes): array
    {
        $availability = [];
        foreach ($items as $itemId => $item) {
            $floor = (int) $item['floor_rank'];
            $isDeclared = (bool) $item['has_declared_availability'] || $floor > 0;
            $availability[$itemId] = [
                'rank' => $floor,
                'type' => $isDeclared ? 'game_state' : 'unknown',
                'confidence' => $isDeclared ? 'declared' : 'unknown',
            ];
        }

        for ($iteration = 0; $iteration < 30; $iteration++) {
            $changed = false;
            foreach ($items as $itemId => $item) {
                $methods = [];
                foreach ($dropMethods[$itemId] ?? [] as $dropMethod) {
                    $sourceItemId = $dropMethod['source_item_id'];
                    if ($sourceItemId !== null) {
                        if (! isset($availability[$sourceItemId]) || $availability[$sourceItemId]['confidence'] === 'unknown') {
                            continue;
                        }
                        $dropMethod['rank'] = max($dropMethod['rank'], $availability[$sourceItemId]['rank']);
                    }
                    $methods[] = $dropMethod;
                }
                foreach ($recipes[$itemId] ?? [] as $recipeIngredients) {
                    $ingredientRanks = [];
                    $known = true;
                    foreach ($recipeIngredients as $alternatives) {
                        $alternativeRanks = [];
                        foreach ($alternatives as $ingredientId) {
                            if (isset($availability[$ingredientId]) && $availability[$ingredientId]['confidence'] !== 'unknown') {
                                $alternativeRanks[] = $availability[$ingredientId]['rank'];
                            }
                        }
                        if ($alternativeRanks === []) {
                            $known = false;
                            break;
                        }
                        $ingredientRanks[] = min($alternativeRanks);
                    }
                    if ($known && $ingredientRanks !== []) {
                        $methods[] = [
                            'rank' => max($ingredientRanks),
                            'type' => 'crafting',
                            'confidence' => 'derived',
                            'source_item_id' => null,
                        ];
                    }
                }

                if ($methods === []) {
                    continue;
                }
                usort($methods, static fn (array $left, array $right): int => $left['rank'] <=> $right['rank']);
                $best = $methods[0];
                $rank = max((int) $item['floor_rank'], $best['rank']);
                $derived = [
                    'rank' => $rank,
                    'type' => $best['type'],
                    'confidence' => $best['confidence'],
                ];
                if ($derived !== $availability[$itemId]) {
                    $availability[$itemId] = $derived;
                    $changed = true;
                }
            }

            if (! $changed) {
                break;
            }
        }

        return $availability;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, array{rank: int, type: string, confidence: string}>  $availability
     * @return list<array{key: string, name: string, rank: int, description: string}>
     */
    private function deriveMilestones(array $items, array $availability, int $tierCount): array
    {
        $weaponRanks = [];
        foreach ($items as $itemId => $item) {
            if ((float) ($item['stats']['damage'] ?? 0) > 0 && $availability[$itemId]['confidence'] !== 'unknown') {
                $weaponRanks[] = $availability[$itemId]['rank'];
            }
        }
        sort($weaponRanks, SORT_NUMERIC);
        $boundaries = [0, 1000, 2000, self::MAX_PROGRESS_RANK];
        $count = count($weaponRanks);
        if ($count > 0) {
            for ($index = 0; $index < $tierCount; $index++) {
                $position = (int) round(($count - 1) * ($index / max(1, $tierCount - 1)));
                $boundaries[] = (int) $weaponRanks[$position];
            }
        }
        $boundaries = array_values(array_unique($boundaries));
        sort($boundaries, SORT_NUMERIC);

        $milestones = [];
        foreach ($boundaries as $index => $rank) {
            $phase = $rank >= 2000 ? 'Post-Moon Lord' : ($rank >= 1000 ? 'Hardmode' : 'Pre-Hardmode');
            $label = $phase.' — Tier '.($index + 1);
            if ($rank === 0) {
                $label = 'Starting availability';
            } elseif ($rank === 1000) {
                $label = 'Hardmode threshold';
            } elseif ($rank === 2000) {
                $label = 'Post-Moon Lord threshold';
            } elseif ($rank === self::MAX_PROGRESS_RANK) {
                $label = 'End of known progression';
            }
            $milestones[] = [
                'key' => 'generated-tier-'.($index + 1),
                'name' => $label,
                'rank' => $rank,
                'description' => 'Generated from item acquisition dependencies and objective game data.',
            ];
        }

        return $milestones;
    }

    /** @param list<int> $archetypeIds */
    private function clearGeneratedData(int $trackId, array $archetypeIds): void
    {
        DB::table('game_planners')->where('track_id', $trackId)->delete();
        DB::table('game_item_availability')->where('track_id', $trackId)->delete();
        DB::table('game_item_archetypes')->whereIn('archetype_id', $archetypeIds)
            ->where('source_type', 'derived')->delete();
        DB::table('game_progression_milestones')->where('track_id', $trackId)->delete();
    }

    /**
     * @param  list<array{key: string, name: string, rank: int, description: string}>  $milestones
     * @return array<string, int>
     */
    private function storeMilestones(int $trackId, array $milestones): array
    {
        $ids = [];
        $previousId = null;
        $now = now();
        foreach ($milestones as $index => $milestone) {
            $id = (int) DB::table('game_progression_milestones')->insertGetId([
                'track_id' => $trackId,
                'milestone_key' => $milestone['key'],
                'name' => $milestone['name'],
                'description' => $milestone['description'],
                'sort_order' => $milestone['rank'],
                'milestone_type' => 'generated',
                'requirements_json' => json_encode(['minimum_rank' => $milestone['rank']], JSON_THROW_ON_ERROR),
                'metadata_json' => json_encode(['algorithm' => self::ALGORITHM_VERSION], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $ids[$milestone['key']] = $id;
            if ($previousId !== null) {
                DB::table('game_milestone_dependencies')->insert([
                    'milestone_id' => $id,
                    'depends_on_milestone_id' => $previousId,
                    'dependency_group' => 'all',
                    'is_required' => true,
                ]);
            }
            $previousId = $id;
        }

        return $ids;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, array{rank: int, type: string, confidence: string}>  $availability
     * @param  list<array{key: string, name: string, rank: int, description: string}>  $milestones
     * @param  array<string, int>  $milestoneIds
     */
    private function storeAvailability(
        int $trackId,
        array $items,
        array $availability,
        array $milestones,
        array $milestoneIds
    ): void {
        $rows = [];
        $now = now();
        foreach ($items as $itemId => $item) {
            $derived = $availability[$itemId];
            $milestone = $this->milestoneForRank($milestones, $derived['rank']);
            $rows[] = [
                'track_id' => $trackId,
                'milestone_id' => $milestoneIds[$milestone['key']],
                'item_global_id' => (string) $item['global_id'],
                'availability_type' => $derived['type'],
                'confidence' => $derived['confidence'],
                'source_type' => 'derived',
                'notes' => 'Generated by '.self::ALGORITHM_VERSION.'.',
                'conditions_json' => json_encode(['rank' => $derived['rank']], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (count($rows) >= 500) {
                DB::table('game_item_availability')->insert($rows);
                $rows = [];
            }
        }
        if ($rows !== []) {
            DB::table('game_item_availability')->insert($rows);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, array{rank: int, type: string, confidence: string}>  $availability
     * @param  array<string, mixed>  $archetype
     * @return list<array<string, mixed>>
     */
    private function candidatesForArchetype(array $items, array $availability, array $archetype): array
    {
        $metadata = $this->decodeJson($archetype['metadata_json'] ?? null);
        $classKeys = $this->stringList($metadata['combat_class_keys'] ?? []);
        $categoryKeys = $this->stringList($metadata['category_keys'] ?? []);
        $propertyKeys = $this->stringList($metadata['property_keys'] ?? []);
        $keyword = strtolower((string) ($archetype['damage_class_key'] ?? $archetype['name'] ?? ''));
        $candidates = [];

        foreach ($items as $itemId => $item) {
            $role = $this->itemRole($item);
            if ($role === null) {
                continue;
            }
            $matchesWeapon = array_intersect($classKeys, $item['classes']) !== []
                || array_intersect($categoryKeys, $item['categories']) !== []
                || array_intersect($propertyKeys, array_keys(array_filter(
                    $item['properties'],
                    static fn (mixed $value): bool => (bool) $value
                ))) !== [];
            $tooltip = strtolower((string) ($item['tooltip'] ?? '').' '.(string) ($item['description'] ?? ''));
            $supportsClass = $role !== 'weapon' && $this->supportsClass($tooltip, $keyword);

            if (! $matchesWeapon && ! $supportsClass) {
                continue;
            }
            $score = $this->powerScore($item, $role, (string) ($metadata['playstyle'] ?? ''));
            if ($score <= 0) {
                continue;
            }
            if ($availability[$itemId]['confidence'] === 'unknown') {
                continue;
            }
            $candidates[] = [
                'item_id' => $itemId,
                'global_id' => (string) $item['global_id'],
                'role' => $role,
                'score' => round($score, 6),
                'rank' => $availability[$itemId]['rank'],
                'confidence' => $availability[$itemId]['confidence'],
            ];
        }

        usort($candidates, static fn (array $left, array $right): int => $left['rank'] <=> $right['rank'] ?: $right['score'] <=> $left['score']);

        return $candidates;
    }

    /** @param array<string, mixed> $item */
    private function itemRole(array $item): ?string
    {
        if (array_intersect(['accessory', 'accessory_items'], $item['categories']) !== []) {
            return 'accessory';
        }
        if (in_array('armor', $item['categories'], true)) {
            $slot = strtolower((string) ($item['properties']['bodyslot'] ?? ''));

            if (str_contains($slot, 'head') || str_contains($slot, 'helmet')) {
                return 'armor_head';
            }
            if (str_contains($slot, 'body') || str_contains($slot, 'shirt')) {
                return 'armor_body';
            }
            if (str_contains($slot, 'pants') || str_contains($slot, 'legs')) {
                return 'armor_legs';
            }

            return 'armor';
        }
        if ((float) ($item['stats']['damage'] ?? 0) > 0) {
            return 'weapon';
        }

        return null;
    }

    private function supportsClass(string $tooltip, string $keyword): bool
    {
        $aliases = match (true) {
            str_contains($keyword, 'summon') => ['summon', 'minion', 'sentry', 'whip'],
            str_contains($keyword, 'ranged') => ['ranged', 'ammo', 'projectile'],
            str_contains($keyword, 'magic') => ['magic', 'mana'],
            str_contains($keyword, 'melee') => ['melee', 'true melee'],
            str_contains($keyword, 'rogue') => ['rogue', 'stealth'],
            default => ['damage', 'critical strike'],
        };

        foreach ($aliases as $alias) {
            if (str_contains($tooltip, $alias)) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $item */
    private function powerScore(array $item, string $role, string $playstyle): float
    {
        $stats = $item['stats'];
        if ($role === 'weapon') {
            $damage = (float) ($stats['damage'] ?? 0);
            $useTime = max(1.0, (float) ($stats['use_time'] ?? $stats['use_animation'] ?? 30));
            $critical = (float) ($stats['critical_chance'] ?? 4);
            $knockback = (float) ($stats['knockback'] ?? 0);
            $mana = (float) ($stats['mana_cost'] ?? 0);
            $velocity = (float) ($stats['shoot_speed'] ?? $stats['velocity'] ?? 0);
            $score = $damage * (60 / $useTime) * (1 + $critical / 100) + log1p(max(0, $knockback)) * 2 + $velocity * 0.2 - $mana * 0.1;
            if ($playstyle === 'stealth') {
                $score = pow(max(1, $damage), 1.15) + $critical + $knockback;
            }

            return $score;
        }

        $tooltip = strtolower((string) ($item['tooltip'] ?? ''));
        preg_match_all('/(\d+(?:\.\d+)?)\s*%/', $tooltip, $matches);
        $percentages = array_sum(array_map('floatval', $matches[1]));
        $defense = (float) ($stats['defense'] ?? 0);

        return $defense * 5 + $percentages + (str_contains($tooltip, 'slot') ? 15 : 0);
    }

    /** @param list<array<string, mixed>> $candidates */
    private function storeItemArchetypes(int $archetypeId, array $candidates): int
    {
        $rows = [];
        $now = now();
        foreach ($candidates as $candidate) {
            $rows[] = [
                'archetype_id' => $archetypeId,
                'item_global_id' => $candidate['global_id'],
                'role' => $candidate['role'],
                'confidence' => $candidate['confidence'],
                'source_type' => 'derived',
                'metadata_json' => json_encode(['score' => $candidate['score']], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if (count($rows) >= 500) {
                DB::table('game_item_archetypes')->insert($rows);
                $rows = [];
            }
        }
        if ($rows !== []) {
            DB::table('game_item_archetypes')->insert($rows);
        }

        return count($candidates);
    }

    /**
     * @param  array<string, mixed>  $archetype
     * @param  list<array<string, mixed>>  $candidates
     * @param  list<array{key: string, name: string, rank: int, description: string}>  $milestones
     * @param  array<string, int>  $milestoneIds
     */
    private function storePlanner(
        int $trackId,
        array $archetype,
        array $candidates,
        array $milestones,
        array $milestoneIds,
        int $recommendationLimit,
        float $minimumUpgrade
    ): int {
        $now = now();
        $plannerKey = (string) $archetype['archetype_key'].'-generated';
        $plannerId = (int) DB::table('game_planners')->insertGetId([
            'track_id' => $trackId,
            'archetype_id' => (int) $archetype['id'],
            'planner_key' => $plannerKey,
            'name' => (string) $archetype['name'].' — generated progression',
            'description' => 'Automatically generated from availability and objective item statistics.',
            'status' => $candidates === [] ? 'draft' : 'published',
            'version' => self::ALGORITHM_VERSION,
            'published_at' => $candidates === [] ? null : $now,
            'metadata_json' => json_encode([
                'algorithm' => self::ALGORITHM_VERSION,
                'candidate_count' => count($candidates),
                'minimum_upgrade_percent' => $minimumUpgrade * 100,
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $recommendationCount = 0;
        $lastPrimaryByRole = [];
        $lastPrimaryScoreByRole = [];

        foreach ($milestones as $milestoneIndex => $milestone) {
            $byRole = [];
            foreach ($candidates as $candidate) {
                if ($candidate['rank'] <= $milestone['rank']) {
                    $byRole[$candidate['role']][] = $candidate;
                }
            }
            foreach ($byRole as &$roleCandidates) {
                usort($roleCandidates, static fn (array $left, array $right): int => $right['score'] <=> $left['score']);
                $roleCandidates = array_slice($roleCandidates, 0, $recommendationLimit);
            }
            unset($roleCandidates);

            $hasMeaningfulChange = $milestoneIndex === 0;
            foreach ($byRole as $role => $roleCandidates) {
                if ($roleCandidates === []) {
                    continue;
                }
                $primary = $roleCandidates[0];
                $previousId = $lastPrimaryByRole[$role] ?? null;
                $previousScore = (float) ($lastPrimaryScoreByRole[$role] ?? 0);
                if ($previousId !== $primary['global_id'] && ($previousScore <= 0 || $primary['score'] >= $previousScore * (1 + $minimumUpgrade))) {
                    $hasMeaningfulChange = true;
                }
            }
            if (! $hasMeaningfulChange || $byRole === []) {
                continue;
            }

            $stepId = (int) DB::table('game_planner_steps')->insertGetId([
                'planner_id' => $plannerId,
                'milestone_id' => $milestoneIds[$milestone['key']],
                'title' => $milestone['name'],
                'notes' => 'Generated when the best available loadout changes materially.',
                'sort_order' => $milestone['rank'],
                'metadata_json' => json_encode(['algorithm' => self::ALGORITHM_VERSION], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($byRole as $role => $roleCandidates) {
                foreach ($roleCandidates as $priority => $candidate) {
                    DB::table('game_planner_step_items')->insert([
                        'step_id' => $stepId,
                        'item_global_id' => $candidate['global_id'],
                        'slot_type' => $role,
                        'recommendation_tier' => $priority === 0 ? 'core' : 'alternative',
                        'priority' => $priority + 1,
                        'quantity' => 1,
                        'notes' => sprintf(
                            'Generated score %.2f; availability confidence: %s.',
                            $candidate['score'],
                            $candidate['confidence']
                        ),
                        'source_url' => null,
                        'conditions_json' => json_encode([
                            'score' => $candidate['score'],
                            'availability_rank' => $candidate['rank'],
                        ], JSON_THROW_ON_ERROR),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $recommendationCount++;
                }
                if ($roleCandidates !== []) {
                    $lastPrimaryByRole[$role] = $roleCandidates[0]['global_id'];
                    $lastPrimaryScoreByRole[$role] = $roleCandidates[0]['score'];
                }
            }
        }

        return $recommendationCount;
    }

    /**
     * @param  list<array{key: string, name: string, rank: int, description: string}>  $milestones
     * @return array{key: string, name: string, rank: int, description: string}
     */
    private function milestoneForRank(array $milestones, int $rank): array
    {
        foreach ($milestones as $milestone) {
            if ($rank <= $milestone['rank']) {
                return $milestone;
            }
        }

        $lastMilestone = end($milestones);
        if ($lastMilestone === false) {
            throw new \LogicException('A progression track must contain at least one milestone.');
        }

        return $lastMilestone;
    }

    /** @param list<float> $values */
    private function lowerBound(array $values, float $target): int
    {
        $low = 0;
        $high = count($values);
        while ($low < $high) {
            $middle = intdiv($low + $high, 2);
            if ($values[$middle] < $target) {
                $low = $middle + 1;
            } else {
                $high = $middle;
            }
        }

        return $low;
    }

    /** @return array<string, mixed> */
    private function decodeJson(mixed $value): array
    {
        if (! is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    /** @return list<string> */
    private function stringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(static fn (mixed $entry): string => (string) $entry, $value));
    }

    private function catalogDatabase(): ConnectionInterface
    {
        return DB::connection((string) config('game-data.connection', config('database.default')));
    }
}
