<?php

namespace App\Services\GameData;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class GamePlannerBuilder
{
    private const ALGORITHM_VERSION = 'unlock-graph-boss-checklist-v5';

    private const RANK_SCALE = 100;

    private const HARDMODE_RANK = 700;

    private const MOON_LORD_RANK = 1800;

    public function __construct(private readonly GameReforgeService $reforges) {}

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
        $recommendationLimit = max(1, min(10, (int) ($trackMetadata['recommendations_per_slot'] ?? 5)));
        $minimumUpgrade = max(0.0, (float) ($trackMetadata['minimum_upgrade_percent'] ?? 8) / 100);

        $progression = $this->loadBossChecklist();
        $items = $this->loadItemFacts();
        $bosses = $this->loadBossRanks($progression);
        $npcRanks = $this->loadNpcRanks($bosses);
        $dropMethods = $this->loadDropMethods($bosses, $npcRanks);
        $recipes = $this->loadRecipes($bosses);
        $availability = $this->deriveAvailability($items, $dropMethods, $recipes);
        $milestones = $this->deriveMilestones($progression);
        $this->reforges->sync();
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
            $this->storeUnlockRules($trackId, $items, $availability);

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
        foreach ([
            'game_progression_tracks', 'game_build_archetypes', 'game_planners',
            'game_item_unlock_rules', 'game_item_unlock_conditions', 'game_reforge_profiles',
        ] as $table) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException('Planner tables are not installed. Run migrations first.');
            }
        }

        $catalogSchema = Schema::connection((string) config('game-data.connection', config('database.default')));
        foreach ([
            'items', 'mods', 'item_stats', 'item_properties', 'categories', 'item_categories', 'combat_classes',
            'item_combat_classes', 'tags', 'item_tags', 'progression_stages', 'item_progression', 'recipes',
            'recipe_ingredients', 'recipe_group_members', 'recipe_stations', 'recipe_conditions',
            'crafting_stations', 'drops', 'npcs', 'npc_stats', 'bosses',
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
            ->get(['ip.item_id', 'ps.global_id', 'ps.sort_order']) as $progression) {
            $row = (array) $progression;
            $itemId = (int) $row['item_id'];
            if (isset($items[$itemId])) {
                $items[$itemId]['has_declared_availability'] = true;
                $stageRank = match ((string) $row['global_id']) {
                    'terraria:pre_hardmode' => 0,
                    'terraria:hardmode' => self::HARDMODE_RANK,
                    'terraria:post_moon_lord' => self::MOON_LORD_RANK,
                    default => max(0, ((int) $row['sort_order'] - 100) * 10),
                };
                $items[$itemId]['floor_rank'] = max(
                    (int) $items[$itemId]['floor_rank'],
                    $stageRank
                );
            }
        }

        foreach ($items as &$item) {
            if (in_array('hardmode', $item['tags'], true) || in_array('hardmodeonly', $item['tags'], true)) {
                $item['floor_rank'] = max(self::HARDMODE_RANK, (int) $item['floor_rank']);
            }
            $raw = strtolower((string) ($item['raw_json'] ?? ''));
            if (str_contains($raw, 'post-moon lord') || str_contains($raw, 'post moon lord')) {
                $item['floor_rank'] = max(self::MOON_LORD_RANK, (int) $item['floor_rank']);
            }
        }
        unset($item);

        return $items;
    }

    /** @return list<array<string, mixed>> */
    private function loadBossChecklist(): array
    {
        $path = (string) config('game-data.boss_checklist_path');
        if ($path === '' || ! is_file($path)) {
            throw new RuntimeException('Boss Checklist progression data is not installed.');
        }

        $decoded = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $entries = $decoded['entries'] ?? null;
        if (! is_array($entries) || $entries === []) {
            throw new RuntimeException('Boss Checklist progression data contains no entries.');
        }

        usort($entries, static fn (array $left, array $right): int => (float) $left['value'] <=> (float) $right['value']);

        return array_values($entries);
    }

    /**
     * @param  list<array<string, mixed>>  $progression
     * @return array<int, array{rank: int, name: string, score: float, entry_key: string, type: string}>
     */
    private function loadBossRanks(array $progression): array
    {
        $bosses = [];
        $rows = $this->catalogDatabase()->table('bosses as b')->join('npcs as n', 'n.id', '=', 'b.npc_id')
            ->get(['n.id', 'n.display_name']);

        foreach ($rows as $rowObject) {
            $row = (array) $rowObject;
            $displayName = (string) $row['display_name'];
            $normalized = $this->normalizeName($displayName);
            foreach ($progression as $entry) {
                if (($entry['type'] ?? null) !== 'boss' && ($entry['type'] ?? null) !== 'miniboss') {
                    continue;
                }
                $aliases = array_values(array_filter([
                    (string) ($entry['name'] ?? ''),
                    ...array_map('strval', is_array($entry['aliases'] ?? null) ? $entry['aliases'] : []),
                ]));
                $matches = false;
                foreach ($aliases as $alias) {
                    $candidate = $this->normalizeName($alias);
                    if ($candidate !== '' && ($normalized === $candidate || str_contains($normalized, $candidate))) {
                        $matches = true;
                        break;
                    }
                }
                if (! $matches) {
                    continue;
                }
                $value = (float) $entry['value'];
                $bosses[(int) $row['id']] = [
                    'rank' => (int) round($value * self::RANK_SCALE),
                    'name' => (string) $entry['name'],
                    'score' => $value,
                    'entry_key' => (string) $entry['key'],
                    'type' => (string) $entry['type'],
                ];
                break;
            }
        }

        $virtualId = -1;
        foreach ($progression as $entry) {
            if (($entry['type'] ?? null) !== 'event') {
                continue;
            }
            $value = (float) $entry['value'];
            $bosses[$virtualId--] = [
                'rank' => (int) round($value * self::RANK_SCALE),
                'name' => (string) $entry['name'],
                'score' => $value,
                'entry_key' => (string) $entry['key'],
                'type' => 'event',
            ];
        }

        return $bosses;
    }

    /** @param array<int, array{rank: int, name: string, score: float, entry_key: string, type: string}> $bosses */
    private function loadNpcRanks(array $bosses): array
    {
        $ranks = [];
        $rows = $this->catalogDatabase()->table('npcs')->get(['id']);
        foreach ($rows as $npc) {
            $row = (array) $npc;
            $npcId = (int) $row['id'];
            $ranks[$npcId] = $bosses[$npcId]['rank'] ?? 0;
        }

        return $ranks;
    }

    /**
     * @param  array<int, array{rank: int, name: string, score: float}>  $bosses
     * @param  array<int, int>  $npcRanks
     * @return array<int, list<array<string, mixed>>>
     */
    private function loadDropMethods(array $bosses, array $npcRanks): array
    {
        $methods = [];
        $npcNames = $this->catalogDatabase()->table('npcs')->pluck('display_name', 'id');
        foreach ($this->catalogDatabase()->table('drops')->whereNotNull('item_id')
            ->get([
                'id', 'item_id', 'npc_id', 'source_item_id', 'unresolved_source_name', 'source_type',
                'condition_text', 'conditions_json',
            ]) as $drop) {
            $row = (array) $drop;
            $rank = 0;
            $confidence = 'derived';
            $requirements = [];
            $npcId = $row['npc_id'] === null ? null : (int) $row['npc_id'];
            $sourceItemId = $row['source_item_id'] === null ? null : (int) $row['source_item_id'];
            if ($npcId !== null && isset($bosses[$npcId])) {
                $rank = $bosses[$npcId]['rank'];
                $requirements[] = [
                    'type' => 'boss_defeated',
                    'operator' => 'requires',
                    'target_type' => $bosses[$npcId]['type'],
                    'target_key' => $bosses[$npcId]['entry_key'],
                    'numeric_value' => $bosses[$npcId]['score'],
                    'label' => 'Derrotar '.$bosses[$npcId]['name'],
                ];
            } elseif ($npcId !== null) {
                $rank = $npcRanks[$npcId] ?? 0;
                $npcName = (string) ($npcNames[$npcId] ?? 'NPC');
                $requirements[] = [
                    'type' => 'npc_drop',
                    'operator' => 'requires',
                    'target_type' => 'npc',
                    'target_key' => (string) $npcId,
                    'label' => 'Obter como drop de '.$npcName,
                ];
            }
            $condition = strtolower(
                (string) ($row['unresolved_source_name'] ?? '').' '.
                (string) ($row['condition_text'] ?? '').' '.
                (string) ($row['conditions_json'] ?? '')
            );
            $rank = max($rank, $this->conditionFloorRank($condition, $bosses));
            $requirements = [...$requirements, ...$this->requirementsFromCondition($condition, $bosses)];
            if ($npcId === null && $sourceItemId === null
                && trim((string) ($row['unresolved_source_name'] ?? '')) !== '' && $rank === 0) {
                $confidence = 'unknown';
            }
            $methods[(int) $row['item_id']][] = [
                'method_key' => 'drop-'.(int) $row['id'],
                'rank' => $rank,
                'type' => (string) $row['source_type'],
                'confidence' => $confidence,
                'source_item_id' => $sourceItemId,
                'label' => $requirements[0]['label'] ?? 'Obter por drop',
                'requirements' => $requirements,
                'priority' => 20,
            ];
        }

        return $methods;
    }

    /**
     * @param  array<int, array{rank: int, name: string, score: float}>  $bosses
     * @return array<int, list<array<string, mixed>>>
     */
    private function loadRecipes(array $bosses): array
    {
        $db = $this->catalogDatabase();
        $recipes = [];
        $rows = $db->table('recipes')->whereNotNull('result_item_id')->where('is_historical', false)
            ->get(['id', 'result_item_id', 'raw_json']);
        $recipeResults = [];
        $recipeConstraints = [];
        $recipeRequirements = [];
        foreach ($rows as $recipe) {
            $row = (array) $recipe;
            $recipeResults[(int) $row['id']] = (int) $row['result_item_id'];
            $recipeConstraints[(int) $row['id']] = (string) ($row['raw_json'] ?? '');
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
        foreach ($db->table('recipe_stations as rs')->join('crafting_stations as station', 'station.id', '=', 'rs.station_id')
            ->whereIn('rs.recipe_id', array_keys($recipeResults))->get(['rs.recipe_id', 'station.name']) as $station) {
            $row = (array) $station;
            $recipeConstraints[(int) $row['recipe_id']] .= ' '.(string) $row['name'];
            $recipeRequirements[(int) $row['recipe_id']][] = [
                'type' => 'crafting_station',
                'operator' => 'requires',
                'target_type' => 'crafting_station',
                'target_key' => $this->normalizeName((string) $row['name']),
                'label' => 'Usar '.$row['name'],
            ];
        }
        foreach ($db->table('recipe_conditions')->whereIn('recipe_id', array_keys($recipeResults))
            ->get(['recipe_id', 'condition_type', 'condition_key', 'description', 'value_json']) as $condition) {
            $row = (array) $condition;
            $recipeConstraints[(int) $row['recipe_id']] .= ' '.implode(' ', array_filter([
                $row['condition_type'], $row['condition_key'], $row['description'], $row['value_json'],
            ], static fn (mixed $value): bool => is_scalar($value)));
            $description = trim((string) ($row['description'] ?? $row['condition_key'] ?? ''));
            if ($description !== '') {
                $recipeRequirements[(int) $row['recipe_id']][] = [
                    'type' => 'game_condition',
                    'operator' => 'requires',
                    'target_type' => (string) ($row['condition_type'] ?? 'condition'),
                    'target_key' => (string) ($row['condition_key'] ?? ''),
                    'text_value' => $description,
                    'label' => $description,
                ];
            }
        }
        foreach ($recipeResults as $recipeId => $resultItemId) {
            if (! isset($invalidRecipes[$recipeId]) && ($ingredients[$recipeId] ?? []) !== []) {
                $conditionText = strtolower($recipeConstraints[$recipeId] ?? '');
                $recipes[$resultItemId][] = [
                    'method_key' => 'recipe-'.$recipeId,
                    'ingredients' => $ingredients[$recipeId],
                    'floor_rank' => $this->conditionFloorRank($conditionText, $bosses),
                    'requirements' => [
                        ...($recipeRequirements[$recipeId] ?? []),
                        ...$this->requirementsFromCondition($conditionText, $bosses),
                    ],
                ];
            }
        }

        return $recipes;
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @param  array<int, list<array<string, mixed>>>  $dropMethods
     * @param  array<int, list<array<string, mixed>>>  $recipes
     * @return array<int, array<string, mixed>>
     */
    private function deriveAvailability(array $items, array $dropMethods, array $recipes): array
    {
        $availability = [];
        foreach ($items as $itemId => $item) {
            $floor = (int) $item['floor_rank'];
            $isDeclared = (bool) $item['has_declared_availability'] || $floor > 0;
            $hasConcreteMethod = ($dropMethods[$itemId] ?? []) !== [] || ($recipes[$itemId] ?? []) !== [];
            $isVendorItem = $this->isVendorItem($item);
            if ($isVendorItem) {
                $availability[$itemId] = [
                    'rank' => $floor,
                    'type' => 'vendor',
                    'confidence' => 'derived',
                    'method_key' => 'vendor',
                    'label' => 'Comprar de um vendedor disponível',
                    'requirements' => [
                        ...$this->floorRequirements($floor),
                        [
                            'type' => 'vendor_available',
                            'operator' => 'requires',
                            'target_type' => 'vendor',
                            'target_key' => null,
                            'label' => 'Encontrar o vendedor correspondente',
                        ],
                    ],
                ];
            } elseif ($isDeclared && ! $hasConcreteMethod) {
                $availability[$itemId] = [
                    'rank' => $floor,
                    'type' => 'game_state',
                    'confidence' => 'declared',
                    'method_key' => 'declared-game-state',
                    'label' => $this->floorLabel($floor),
                    'requirements' => $this->floorRequirements($floor),
                ];
            } else {
                $availability[$itemId] = [
                    'rank' => $floor,
                    'type' => 'unknown',
                    'confidence' => 'unknown',
                    'method_key' => 'unknown',
                    'label' => 'Condição de desbloqueio ainda desconhecida',
                    'requirements' => $this->floorRequirements($floor),
                ];
            }
        }

        for ($iteration = 0; $iteration < 30; $iteration++) {
            $changed = false;
            foreach ($items as $itemId => $item) {
                $methods = [];
                $specialMethod = $this->specialUnlockMethod($item);
                if ($specialMethod !== null) {
                    $methods[] = $specialMethod;
                }
                if (in_array($availability[$itemId]['type'], ['vendor', 'game_state'], true)) {
                    $methods[] = [
                        ...$availability[$itemId],
                        'source_item_id' => null,
                        'priority' => 10,
                    ];
                }
                foreach ($dropMethods[$itemId] ?? [] as $dropMethod) {
                    if ($dropMethod['confidence'] === 'unknown') {
                        continue;
                    }
                    $sourceItemId = $dropMethod['source_item_id'];
                    if ($sourceItemId !== null) {
                        if (! isset($availability[$sourceItemId]) || $availability[$sourceItemId]['confidence'] === 'unknown') {
                            continue;
                        }
                        $dropMethod['rank'] = max($dropMethod['rank'], $availability[$sourceItemId]['rank']);
                        $dropMethod['requirements'][] = [
                            'type' => 'item_available',
                            'operator' => 'requires',
                            'target_type' => 'item',
                            'target_key' => (string) $items[$sourceItemId]['global_id'],
                            'label' => 'Obter '.(string) $items[$sourceItemId]['display_name'],
                        ];
                    }
                    $methods[] = $dropMethod;
                }
                foreach ($recipes[$itemId] ?? [] as $recipe) {
                    $ingredientRanks = [];
                    $ingredientRequirements = [];
                    $known = true;
                    foreach ($recipe['ingredients'] as $alternatives) {
                        $alternativeRanks = [];
                        $alternativeItems = [];
                        foreach ($alternatives as $ingredientId) {
                            if (isset($availability[$ingredientId]) && $availability[$ingredientId]['confidence'] !== 'unknown') {
                                $alternativeRanks[] = $availability[$ingredientId]['rank'];
                                $alternativeItems[] = [
                                    'global_id' => (string) $items[$ingredientId]['global_id'],
                                    'name' => (string) $items[$ingredientId]['display_name'],
                                ];
                            }
                        }
                        if ($alternativeRanks === []) {
                            $known = false;
                            break;
                        }
                        $ingredientRanks[] = min($alternativeRanks);
                        $ingredientRequirements[] = [
                            'type' => 'item_available',
                            'operator' => count($alternativeItems) > 1 ? 'any_of' : 'requires',
                            'target_type' => 'item',
                            'target_key' => count($alternativeItems) === 1 ? $alternativeItems[0]['global_id'] : null,
                            'value_json' => $alternativeItems,
                            'label' => 'Obter '.implode(' ou ', array_column($alternativeItems, 'name')),
                        ];
                    }
                    if ($known && $ingredientRanks !== []) {
                        $methods[] = [
                            'method_key' => $recipe['method_key'],
                            'rank' => max($recipe['floor_rank'], max($ingredientRanks)),
                            'type' => 'crafting',
                            'confidence' => 'derived',
                            'source_item_id' => null,
                            'label' => 'Fabricar o item',
                            'requirements' => [
                                ...$ingredientRequirements,
                                ...$recipe['requirements'],
                            ],
                            'priority' => 30,
                        ];
                    }
                }

                if ($methods === []) {
                    continue;
                }
                usort($methods, static fn (array $left, array $right): int => max($floor, (int) $left['rank'])
                    <=> max($floor, (int) $right['rank'])
                    ?: (int) ($left['priority'] ?? 100) <=> (int) ($right['priority'] ?? 100)
                );
                $best = $methods[0];
                $rank = max((int) $item['floor_rank'], $best['rank']);
                $derived = [
                    'rank' => $rank,
                    'type' => $best['type'],
                    'confidence' => $best['confidence'],
                    'method_key' => $best['method_key'] ?? $best['type'],
                    'label' => $best['label'] ?? 'Desbloquear o item',
                    'requirements' => [
                        ...$this->floorRequirements((int) $item['floor_rank']),
                        ...($best['requirements'] ?? []),
                    ],
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

    /** @param array<string, mixed> $item */
    private function specialUnlockMethod(array $item): ?array
    {
        $oreTiers = [
            'terraria:cobalt_ore' => [1, 100, 'Molten Pickaxe ou equivalente'],
            'terraria:palladium_ore' => [1, 100, 'Molten Pickaxe ou equivalente'],
            'terraria:mythril_ore' => [2, 110, 'Cobalt/Palladium Pickaxe ou equivalente'],
            'terraria:orichalcum_ore' => [2, 110, 'Cobalt/Palladium Pickaxe ou equivalente'],
            'terraria:adamantite_ore' => [3, 150, 'Mythril/Orichalcum Pickaxe ou equivalente'],
            'terraria:titanium_ore' => [3, 150, 'Mythril/Orichalcum Pickaxe ou equivalente'],
        ];
        $globalId = (string) $item['global_id'];
        if (! isset($oreTiers[$globalId])) {
            return null;
        }

        [$tier, $pickaxePower, $toolLabel] = $oreTiers[$globalId];

        return [
            'method_key' => 'mine-hardmode-ore-tier-'.$tier,
            'rank' => self::HARDMODE_RANK,
            'type' => 'mining',
            'confidence' => 'curated',
            'source_item_id' => null,
            'priority' => 0,
            'label' => 'Minerar '.(string) $item['display_name'],
            'requirements' => [
                [
                    'type' => 'boss_defeated',
                    'operator' => 'requires',
                    'target_type' => 'boss',
                    'target_key' => 'wall-of-flesh',
                    'numeric_value' => 7,
                    'label' => 'Derrotar Wall of Flesh',
                ],
                [
                    'type' => 'world_resource_generated',
                    'operator' => 'requires',
                    'target_type' => 'ore_tier',
                    'target_key' => 'hardmode-ore-tier-'.$tier,
                    'numeric_value' => $tier,
                    'label' => 'Gerar o minério de nível '.$tier.' no mundo',
                ],
                [
                    'type' => 'tool_power',
                    'operator' => 'at_least',
                    'target_type' => 'pickaxe',
                    'target_key' => null,
                    'numeric_value' => $pickaxePower,
                    'text_value' => $toolLabel,
                    'label' => 'Usar '.$toolLabel.' ('.$pickaxePower.'% pickaxe power)',
                ],
            ],
        ];
    }

    /** @param array<string, mixed> $item */
    private function isVendorItem(array $item): bool
    {
        foreach ($item['tags'] as $tag) {
            if ($tag === 'vendor' || str_starts_with($tag, 'vendor:')) {
                return true;
            }
        }

        $raw = (string) ($item['raw_json'] ?? '');

        return preg_match('/"buy"\s*:\s*"(?!")/', $raw) === 1;
    }

    private function conditionMentionsBoss(string $condition, string $bossName): bool
    {
        $normalizedName = strtolower($bossName);
        if (str_contains($condition, $normalizedName)) {
            return true;
        }

        $stopWords = ['body', 'head', 'tail', 'left', 'right', 'the', 'of'];
        $tokens = preg_split('/[^a-z0-9]+/', $normalizedName) ?: [];
        $tokens = array_values(array_filter($tokens, static fn (string $token): bool => $token !== '' && ! in_array($token, $stopWords, true)
        ));
        $numbers = array_values(array_filter($tokens, static fn (string $token): bool => ctype_digit($token)));
        foreach ($numbers as $number) {
            if (preg_match('/\b'.preg_quote($number, '/').'\b/', $condition) !== 1) {
                return false;
            }
        }
        $words = array_values(array_filter($tokens, static fn (string $token): bool => ! ctype_digit($token) && strlen($token) >= 4
        ));
        if ($words === []) {
            return false;
        }
        foreach ($words as $word) {
            if (strlen($word) >= 8 && preg_match('/\b'.preg_quote($word, '/').'\b/', $condition) === 1) {
                return true;
            }
        }
        $matches = count(array_filter($words, static fn (string $token): bool => preg_match('/\b'.preg_quote($token, '/').'\b/', $condition) === 1
        ));

        return $matches >= min(2, count($words));
    }

    /** @param array<int, array{rank: int, name: string, score: float, entry_key: string, type: string}> $bosses */
    private function conditionFloorRank(string $condition, array $bosses): int
    {
        $rank = 0;
        if (str_contains($condition, 'moon lord')) {
            $rank = self::MOON_LORD_RANK;
        } elseif (str_contains($condition, 'hardmode')) {
            $rank = self::HARDMODE_RANK;
        }
        foreach ($bosses as $boss) {
            if ($this->conditionMentionsBoss($condition, $boss['name'])) {
                $rank = max($rank, $boss['rank']);
            }
        }

        return $rank;
    }

    /**
     * @param  array<int, array{rank: int, name: string, score: float, entry_key: string, type: string}>  $bosses
     * @return list<array<string, mixed>>
     */
    private function requirementsFromCondition(string $condition, array $bosses): array
    {
        $requirements = [];
        if (str_contains($condition, 'hardmode')) {
            $requirements[] = [
                'type' => 'boss_defeated',
                'operator' => 'requires',
                'target_type' => 'boss',
                'target_key' => 'wall-of-flesh',
                'numeric_value' => 7,
                'label' => 'Derrotar Wall of Flesh',
            ];
        }
        if (str_contains($condition, 'moon lord')) {
            $requirements[] = [
                'type' => 'boss_defeated',
                'operator' => 'requires',
                'target_type' => 'boss',
                'target_key' => 'moon-lord',
                'numeric_value' => 18,
                'label' => 'Derrotar Moon Lord',
            ];
        }
        foreach ($bosses as $boss) {
            if (! $this->conditionMentionsBoss($condition, $boss['name'])) {
                continue;
            }
            $requirements[] = [
                'type' => 'boss_defeated',
                'operator' => 'requires',
                'target_type' => $boss['type'],
                'target_key' => $boss['entry_key'],
                'numeric_value' => $boss['score'],
                'label' => 'Derrotar '.$boss['name'],
            ];
        }

        return $this->uniqueRequirements($requirements);
    }

    /** @return list<array<string, mixed>> */
    private function floorRequirements(int $rank): array
    {
        if ($rank >= self::MOON_LORD_RANK) {
            return [[
                'type' => 'boss_defeated',
                'operator' => 'requires',
                'target_type' => 'boss',
                'target_key' => 'moon-lord',
                'numeric_value' => 18,
                'label' => 'Derrotar Moon Lord',
            ]];
        }
        if ($rank >= self::HARDMODE_RANK) {
            return [[
                'type' => 'boss_defeated',
                'operator' => 'requires',
                'target_type' => 'boss',
                'target_key' => 'wall-of-flesh',
                'numeric_value' => 7,
                'label' => 'Derrotar Wall of Flesh',
            ]];
        }

        return [];
    }

    private function floorLabel(int $rank): string
    {
        return match (true) {
            $rank >= self::MOON_LORD_RANK => 'Disponível após derrotar Moon Lord',
            $rank >= self::HARDMODE_RANK => 'Disponível após derrotar Wall of Flesh',
            default => 'Disponível no início da jornada',
        };
    }

    /** @param list<array<string, mixed>> $requirements */
    private function uniqueRequirements(array $requirements): array
    {
        $seen = [];

        return array_values(array_filter($requirements, static function (array $requirement) use (&$seen): bool {
            $key = implode('|', [
                (string) ($requirement['type'] ?? ''),
                (string) ($requirement['operator'] ?? ''),
                (string) ($requirement['target_key'] ?? ''),
                (string) ($requirement['label'] ?? ''),
            ]);
            if (isset($seen[$key])) {
                return false;
            }
            $seen[$key] = true;

            return true;
        }));
    }

    private function normalizeName(string $value): string
    {
        $normalized = strtolower(trim($value));

        return preg_replace('/[^a-z0-9]+/', '', $normalized) ?? '';
    }

    /**
     * @param  list<array<string, mixed>>  $progression
     * @return list<array<string, mixed>>
     */
    private function deriveMilestones(array $progression): array
    {
        $milestones = [];
        foreach ($progression as $entry) {
            $value = (float) $entry['value'];
            $type = (string) $entry['type'];
            $milestones[] = [
                'key' => (string) $entry['key'],
                'name' => (string) $entry['name'],
                'rank' => (int) round($value * self::RANK_SCALE),
                'description' => $type === 'start'
                    ? 'Itens disponíveis antes do primeiro marco da Boss Checklist.'
                    : 'Marco de progressão importado da Boss Checklist.',
                'type' => $type,
                'source_system' => 'boss_checklist',
                'source_key' => (string) $entry['key'],
                'progression_value' => $value,
            ];
        }

        return $milestones;
    }

    /** @param list<int> $archetypeIds */
    private function clearGeneratedData(int $trackId, array $archetypeIds): void
    {
        DB::table('game_item_unlock_rules')->where('track_id', $trackId)->delete();
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
                'milestone_type' => $milestone['type'],
                'source_system' => $milestone['source_system'],
                'source_key' => $milestone['source_key'],
                'progression_value' => $milestone['progression_value'],
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
     * @param  array<int, array<string, mixed>>  $availability
     */
    private function storeUnlockRules(int $trackId, array $items, array $availability): void
    {
        $now = now();
        $rows = [];
        $requirementsByRule = [];
        foreach ($items as $itemId => $item) {
            $unlock = $availability[$itemId];
            $globalId = (string) $item['global_id'];
            $methodKey = (string) $unlock['method_key'];
            $rows[] = [
                'track_id' => $trackId,
                'item_global_id' => $globalId,
                'method_key' => $methodKey,
                'method_type' => (string) $unlock['type'],
                'label' => (string) $unlock['label'],
                'source_type' => 'derived',
                'confidence' => (string) $unlock['confidence'],
                'progression_value' => round(((int) $unlock['rank']) / self::RANK_SCALE, 3),
                'metadata_json' => json_encode([
                    'algorithm' => self::ALGORITHM_VERSION,
                    'rank' => (int) $unlock['rank'],
                ], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $requirementsByRule[$globalId.'|'.$methodKey] = $this->uniqueRequirements(
                (array) ($unlock['requirements'] ?? [])
            );
            if (count($rows) >= 500) {
                DB::table('game_item_unlock_rules')->insert($rows);
                $rows = [];
            }
        }
        if ($rows !== []) {
            DB::table('game_item_unlock_rules')->insert($rows);
        }

        $ruleIds = DB::table('game_item_unlock_rules')->where('track_id', $trackId)
            ->get(['id', 'item_global_id', 'method_key'])->mapWithKeys(static function (object $row): array {
                $data = (array) $row;

                return [(string) $data['item_global_id'].'|'.(string) $data['method_key'] => (int) $data['id']];
            });
        $conditionRows = [];
        foreach ($requirementsByRule as $ruleKey => $requirements) {
            $ruleId = $ruleIds->get($ruleKey);
            if ($ruleId === null) {
                continue;
            }
            foreach ($requirements as $index => $requirement) {
                $conditionRows[] = [
                    'unlock_rule_id' => $ruleId,
                    'condition_group' => 'all',
                    'condition_type' => (string) ($requirement['type'] ?? 'game_condition'),
                    'operator' => (string) ($requirement['operator'] ?? 'requires'),
                    'target_type' => $requirement['target_type'] ?? null,
                    'target_key' => $requirement['target_key'] ?? null,
                    'numeric_value' => $requirement['numeric_value'] ?? null,
                    'text_value' => $requirement['text_value'] ?? null,
                    'value_json' => isset($requirement['value_json'])
                        ? json_encode($requirement['value_json'], JSON_THROW_ON_ERROR)
                        : null,
                    'label' => (string) ($requirement['label'] ?? 'Cumprir a condição'),
                    'sort_order' => $index,
                    'metadata_json' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                if (count($conditionRows) >= 500) {
                    DB::table('game_item_unlock_conditions')->insert($conditionRows);
                    $conditionRows = [];
                }
            }
        }
        if ($conditionRows !== []) {
            DB::table('game_item_unlock_conditions')->insert($conditionRows);
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
        $nameKeywords = $this->stringList($metadata['name_keywords'] ?? []);
        $tooltipKeywords = $this->stringList($metadata['tooltip_keywords'] ?? []);
        $keyword = strtolower((string) ($archetype['damage_class_key'] ?? $archetype['name'] ?? ''));
        $candidates = [];

        foreach ($items as $itemId => $item) {
            $role = $this->itemRole($item);
            if ($role === null) {
                continue;
            }
            $name = strtolower((string) ($item['display_name'] ?? ''));
            $tooltip = strtolower((string) ($item['tooltip'] ?? '').' '.(string) ($item['description'] ?? ''));
            $matchesArchetype = array_intersect($classKeys, $item['classes']) !== []
                || array_intersect($categoryKeys, $item['categories']) !== []
                || array_intersect($propertyKeys, array_keys(array_filter(
                    $item['properties'],
                    static fn (mixed $value): bool => (bool) $value
                ))) !== []
                || $this->containsAny($name, $nameKeywords)
                || $this->containsAny($tooltip, $tooltipKeywords);
            $supportsClass = $role !== 'weapon' && $this->supportsClass($tooltip, $keyword);
            $isEquipment = $role !== 'weapon';
            $belongsToAnotherClass = $isEquipment && $item['classes'] !== [] && ! $matchesArchetype;

            if ((! $isEquipment && ! $matchesArchetype) || $belongsToAnotherClass) {
                continue;
            }
            $vector = $this->powerVector($item, $role, (string) ($metadata['playstyle'] ?? ''));
            $score = $this->scoreVector($vector, 0);
            if ($score <= 0) {
                continue;
            }
            if ($isEquipment) {
                $multiplier = $matchesArchetype || $supportsClass ? 1.2 : 0.9;
                $vector = array_map(static fn (float $value): float => $value * $multiplier, $vector);
                $score = $this->scoreVector($vector, 0);
            }
            if ($availability[$itemId]['confidence'] === 'unknown') {
                continue;
            }
            $candidates[] = [
                'item_id' => $itemId,
                'global_id' => (string) $item['global_id'],
                'role' => $role,
                'score' => round($score, 6),
                'score_vector' => array_map(static fn (float $value): float => round($value, 6), $vector),
                'rank' => $availability[$itemId]['rank'],
                'confidence' => $availability[$itemId]['confidence'],
            ];
        }

        usort($candidates, static fn (array $left, array $right): int => $left['rank'] <=> $right['rank'] ?: $right['score'] <=> $left['score']);

        return $candidates;
    }

    /** @param list<string> $needles */
    private function containsAny(string $value, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($value, strtolower($needle))) {
                return true;
            }
        }

        return false;
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
    /** @return array{offense: float, defense: float, utility: float} */
    private function powerVector(array $item, string $role, string $playstyle): array
    {
        $stats = $item['stats'];
        if ($role === 'weapon') {
            $damage = (float) ($stats['damage'] ?? 0);
            $useTime = max(1.0, (float) ($stats['use_time'] ?? $stats['use_animation'] ?? 30));
            $critical = (float) ($stats['critical_chance'] ?? 4);
            $knockback = (float) ($stats['knockback'] ?? 0);
            $mana = (float) ($stats['mana_cost'] ?? 0);
            $velocity = (float) ($stats['shoot_speed'] ?? $stats['velocity'] ?? 0);
            $offense = $damage * (60 / $useTime) * (1 + $critical / 100);
            if ($playstyle === 'stealth') {
                $offense = pow(max(1, $damage), 1.15) + $critical + $knockback;
            }

            return [
                'offense' => $offense,
                'defense' => 0.0,
                'utility' => log1p(max(0, $knockback)) * 2 + $velocity * 0.2 - $mana * 0.1,
            ];
        }

        $tooltip = strtolower((string) ($item['tooltip'] ?? ''));
        $defense = (float) ($stats['defense'] ?? 0);
        $vector = ['offense' => 0.0, 'defense' => $defense * 5, 'utility' => 0.0];
        preg_match_all('/(\d+(?:\.\d+)?)\s*%\s*([^.;,\n]*)/', $tooltip, $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $value = (float) $match[1];
            $effect = (string) ($match[2] ?? '');
            if ($this->containsAny($effect, ['damage reduction', 'endurance', 'dodge', 'life', 'defense', 'damage taken'])) {
                $vector['defense'] += $value;
            } elseif ($this->containsAny($effect, ['damage', 'critical', 'crit', 'attack speed', 'melee speed', 'minion', 'stealth'])) {
                $vector['offense'] += $value;
            } else {
                $vector['utility'] += $value;
            }
        }
        if (str_contains($tooltip, 'immun')) {
            $vector['defense'] += 12;
        }
        if (str_contains($tooltip, 'regeneration') || str_contains($tooltip, 'regen')) {
            $vector['defense'] += 8;
        }
        if (str_contains($tooltip, 'mana') || str_contains($tooltip, 'movement') || str_contains($tooltip, 'flight')) {
            $vector['utility'] += 8;
        }
        if (str_contains($tooltip, 'slot')) {
            $vector['utility'] += 15;
        }

        return $vector;
    }

    /** @param array{offense: float, defense: float, utility: float} $vector */
    private function scoreVector(array $vector, int $balance): float
    {
        $balance = max(-100, min(100, $balance));
        if ($balance <= 0) {
            $position = ($balance + 100) / 100;
            $weights = [
                'offense' => 0.35 + (0.75 - 0.35) * $position,
                'defense' => 1.0 + (0.75 - 1.0) * $position,
                'utility' => 0.45 + (0.5 - 0.45) * $position,
            ];
        } else {
            $position = $balance / 100;
            $weights = [
                'offense' => 0.75 + (1.0 - 0.75) * $position,
                'defense' => 0.75 + (0.15 - 0.75) * $position,
                'utility' => 0.5 + (0.3 - 0.5) * $position,
            ];
        }

        return $vector['offense'] * $weights['offense']
            + $vector['defense'] * $weights['defense']
            + $vector['utility'] * $weights['utility'];
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
                'metadata_json' => json_encode([
                    'score' => $candidate['score'],
                    'score_vector' => $candidate['score_vector'],
                ], JSON_THROW_ON_ERROR),
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
                'recommendation_limit' => $recommendationLimit,
                'balance_range' => [-100, 100],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $stepRows = [];
        foreach ($milestones as $milestone) {
            $stepRows[] = [
                'planner_id' => $plannerId,
                'milestone_id' => $milestoneIds[$milestone['key']],
                'title' => $milestone['name'],
                'notes' => 'Generated for every derived progression milestone using the best currently available loadout.',
                'sort_order' => $milestone['rank'],
                'metadata_json' => json_encode(['algorithm' => self::ALGORITHM_VERSION], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        DB::table('game_planner_steps')->insert($stepRows);
        $stepIds = DB::table('game_planner_steps')->where('planner_id', $plannerId)
            ->get(['id', 'milestone_id'])->mapWithKeys(static function (object $row): array {
                $data = (array) $row;

                return [(int) $data['milestone_id'] => (int) $data['id']];
            });

        $recommendationCount = 0;
        $recommendationRows = [];
        foreach ($milestones as $milestone) {
            $byRole = [];
            foreach ($candidates as $candidate) {
                if ($candidate['rank'] <= $milestone['rank']) {
                    $byRole[$candidate['role']][] = $candidate;
                }
            }
            foreach ($byRole as $role => &$roleCandidates) {
                $selected = [];
                $anchorLimit = $role === 'accessory' ? $recommendationLimit : 1;
                foreach ([-100, 0, 100] as $balance) {
                    $ranked = $roleCandidates;
                    usort($ranked, fn (array $left, array $right): int => $this->scoreVector($right['score_vector'], $balance)
                        <=> $this->scoreVector($left['score_vector'], $balance)
                    );
                    foreach (array_slice($ranked, 0, $anchorLimit) as $candidate) {
                        $selected[$candidate['global_id']] = $candidate;
                    }
                }
                $roleCandidates = array_values($selected);
                usort($roleCandidates, fn (array $left, array $right): int => $this->scoreVector($right['score_vector'], 0)
                    <=> $this->scoreVector($left['score_vector'], 0)
                );
            }
            unset($roleCandidates);

            $stepId = (int) $stepIds->get($milestoneIds[$milestone['key']]);

            foreach ($byRole as $role => $roleCandidates) {
                foreach ($roleCandidates as $priority => $candidate) {
                    $recommendationRows[] = [
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
                            'score_vector' => $candidate['score_vector'],
                            'anchor_scores' => [
                                'defense' => round($this->scoreVector($candidate['score_vector'], -100), 6),
                                'balanced' => round($this->scoreVector($candidate['score_vector'], 0), 6),
                                'damage' => round($this->scoreVector($candidate['score_vector'], 100), 6),
                            ],
                            'availability_rank' => $candidate['rank'],
                        ], JSON_THROW_ON_ERROR),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                    $recommendationCount++;
                    if (count($recommendationRows) >= 500) {
                        DB::table('game_planner_step_items')->insert($recommendationRows);
                        $recommendationRows = [];
                    }
                }
            }
        }
        if ($recommendationRows !== []) {
            DB::table('game_planner_step_items')->insert($recommendationRows);
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
