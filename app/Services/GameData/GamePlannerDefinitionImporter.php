<?php

namespace App\Services\GameData;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use JsonException;
use RuntimeException;

class GamePlannerDefinitionImporter
{
    /** @return array<string, int|string> */
    public function import(string $path, bool $replace = false): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException("Planner definition is not readable: {$path}");
        }

        if (! Schema::hasTable('game_progression_tracks')) {
            throw new RuntimeException('Planner tables are not installed. Run migrations first.');
        }

        try {
            $definition = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException("Invalid planner JSON: {$exception->getMessage()}", 0, $exception);
        }

        if (! is_array($definition)) {
            throw new RuntimeException('Planner definition must be a JSON object.');
        }

        $track = $this->requiredArray($definition, 'track');
        $trackKey = $this->requiredString($track, 'key');
        $milestones = $this->list($definition, 'milestones');
        $archetypes = $this->list($definition, 'archetypes');
        $planners = $this->list($definition, 'planners');

        return DB::transaction(function () use ($definition, $track, $trackKey, $milestones, $archetypes, $planners, $replace): array {
            $db = DB::connection();

            if ($replace) {
                $db->table('game_progression_tracks')->where('track_key', $trackKey)->delete();
            }

            $trackId = $this->upsertTrack($db, $track);
            $milestoneIds = $this->upsertMilestones($db, $trackId, $milestones);
            $this->syncMilestoneDependencies($db, $milestones, $milestoneIds);
            $archetypeIds = $this->upsertArchetypes($db, $archetypes);
            $itemArchetypes = $this->syncItemArchetypes($db, $this->list($definition, 'item_archetypes'), $archetypeIds);
            $availability = $this->syncAvailability(
                $db,
                $trackId,
                $this->list($definition, 'availability'),
                $milestoneIds
            );
            $plannerItemCount = $this->syncPlanners($db, $trackId, $planners, $milestoneIds, $archetypeIds);

            return [
                'track' => $trackKey,
                'milestones' => count($milestoneIds),
                'archetypes' => count($archetypeIds),
                'item_archetypes' => $itemArchetypes,
                'availability_rules' => $availability,
                'planners' => count($planners),
                'planner_items' => $plannerItemCount,
            ];
        });
    }

    /** @param array<string, mixed> $track */
    private function upsertTrack(ConnectionInterface $db, array $track): int
    {
        $key = $this->requiredString($track, 'key');
        $now = now();
        $values = [
            'game_key' => $this->requiredString($track, 'game_key'),
            'name' => $this->requiredString($track, 'name'),
            'game_version' => $this->nullableString($track, 'game_version'),
            'mod_versions_json' => $this->json($track['mod_versions'] ?? null),
            'difficulty_key' => $this->string($track, 'difficulty', 'any'),
            'world_variant' => $this->nullableString($track, 'world_variant'),
            'is_active' => (bool) ($track['active'] ?? true),
            'metadata_json' => $this->json($track['metadata'] ?? null),
            'updated_at' => $now,
        ];

        $existing = $db->table('game_progression_tracks')->where('track_key', $key)->value('id');
        if ($existing !== null) {
            $db->table('game_progression_tracks')->where('id', $existing)->update($values);

            return (int) $existing;
        }

        return (int) $db->table('game_progression_tracks')->insertGetId([
            'track_key' => $key,
            ...$values,
            'created_at' => $now,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $milestones
     * @return array<string, int>
     */
    private function upsertMilestones(ConnectionInterface $db, int $trackId, array $milestones): array
    {
        $ids = [];
        $now = now();

        foreach ($milestones as $milestone) {
            $key = $this->requiredString($milestone, 'key');
            $values = [
                'name' => $this->requiredString($milestone, 'name'),
                'description' => $this->nullableString($milestone, 'description'),
                'sort_order' => (int) ($milestone['order'] ?? 0),
                'milestone_type' => $this->string($milestone, 'type', 'progression'),
                'requirements_json' => $this->json($milestone['requirements'] ?? null),
                'metadata_json' => $this->json($milestone['metadata'] ?? null),
                'updated_at' => $now,
            ];
            $existing = $db->table('game_progression_milestones')
                ->where('track_id', $trackId)->where('milestone_key', $key)->value('id');

            if ($existing !== null) {
                $db->table('game_progression_milestones')->where('id', $existing)->update($values);
                $ids[$key] = (int) $existing;
            } else {
                $ids[$key] = (int) $db->table('game_progression_milestones')->insertGetId([
                    'track_id' => $trackId,
                    'milestone_key' => $key,
                    ...$values,
                    'created_at' => $now,
                ]);
            }
        }

        return $ids;
    }

    /**
     * @param  list<array<string, mixed>>  $milestones
     * @param  array<string, int>  $milestoneIds
     */
    private function syncMilestoneDependencies(ConnectionInterface $db, array $milestones, array $milestoneIds): void
    {
        $db->table('game_milestone_dependencies')->whereIn('milestone_id', array_values($milestoneIds))->delete();

        foreach ($milestones as $milestone) {
            $key = $this->requiredString($milestone, 'key');
            foreach ($this->stringList($milestone, 'depends_on') as $dependencyKey) {
                if (! isset($milestoneIds[$dependencyKey])) {
                    throw new RuntimeException("Unknown milestone dependency: {$dependencyKey}");
                }
                $db->table('game_milestone_dependencies')->insert([
                    'milestone_id' => $milestoneIds[$key],
                    'depends_on_milestone_id' => $milestoneIds[$dependencyKey],
                    'dependency_group' => 'all',
                    'is_required' => true,
                ]);
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $archetypes
     * @return array<string, int>
     */
    private function upsertArchetypes(ConnectionInterface $db, array $archetypes): array
    {
        $ids = [];
        $now = now();

        foreach ($archetypes as $archetype) {
            $key = $this->requiredString($archetype, 'key');
            $values = [
                'parent_id' => null,
                'game_key' => $this->string($archetype, 'game_key', 'terraria'),
                'mod_key' => $this->nullableString($archetype, 'mod_key'),
                'name' => $this->requiredString($archetype, 'name'),
                'kind' => $this->string($archetype, 'kind', 'subclass'),
                'damage_class_key' => $this->nullableString($archetype, 'damage_class_key'),
                'description' => $this->nullableString($archetype, 'description'),
                'sort_order' => (int) ($archetype['order'] ?? 0),
                'is_active' => (bool) ($archetype['active'] ?? true),
                'metadata_json' => $this->json($archetype['metadata'] ?? null),
                'updated_at' => $now,
            ];
            $existing = $db->table('game_build_archetypes')->where('archetype_key', $key)->value('id');
            if ($existing !== null) {
                $db->table('game_build_archetypes')->where('id', $existing)->update($values);
                $ids[$key] = (int) $existing;
            } else {
                $ids[$key] = (int) $db->table('game_build_archetypes')->insertGetId([
                    'archetype_key' => $key,
                    ...$values,
                    'created_at' => $now,
                ]);
            }
        }

        foreach ($archetypes as $archetype) {
            $key = $this->requiredString($archetype, 'key');
            $parentKey = $this->nullableString($archetype, 'parent');
            if ($parentKey !== null && ! isset($ids[$parentKey])) {
                throw new RuntimeException("Unknown archetype parent: {$parentKey}");
            }
            $db->table('game_build_archetypes')->where('id', $ids[$key])->update([
                'parent_id' => $parentKey === null ? null : $ids[$parentKey],
            ]);
        }

        return $ids;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @param  array<string, int>  $archetypeIds
     */
    private function syncItemArchetypes(ConnectionInterface $db, array $items, array $archetypeIds): int
    {
        $count = 0;
        foreach ($items as $item) {
            $archetypeKey = $this->requiredString($item, 'archetype');
            if (! isset($archetypeIds[$archetypeKey])) {
                throw new RuntimeException("Unknown item archetype: {$archetypeKey}");
            }
            $globalId = $this->requiredString($item, 'item');
            $this->assertItemExists($globalId);
            $role = $this->string($item, 'role', 'primary');
            $now = now();
            $db->table('game_item_archetypes')->updateOrInsert([
                'archetype_id' => $archetypeIds[$archetypeKey],
                'item_global_id' => $globalId,
                'role' => $role,
            ], [
                'confidence' => $this->string($item, 'confidence', 'declared'),
                'source_type' => $this->string($item, 'source_type', 'curated'),
                'metadata_json' => $this->json($item['metadata'] ?? null),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $count++;
        }

        return $count;
    }

    /**
     * @param  list<array<string, mixed>>  $availability
     * @param  array<string, int>  $milestoneIds
     */
    private function syncAvailability(ConnectionInterface $db, int $trackId, array $availability, array $milestoneIds): int
    {
        $db->table('game_item_availability')->where('track_id', $trackId)->delete();

        foreach ($availability as $rule) {
            $milestoneKey = $this->requiredString($rule, 'milestone');
            if (! isset($milestoneIds[$milestoneKey])) {
                throw new RuntimeException("Unknown availability milestone: {$milestoneKey}");
            }
            $globalId = $this->requiredString($rule, 'item');
            $this->assertItemExists($globalId);
            $now = now();
            $db->table('game_item_availability')->insert([
                'track_id' => $trackId,
                'milestone_id' => $milestoneIds[$milestoneKey],
                'item_global_id' => $globalId,
                'availability_type' => $this->string($rule, 'type', 'unknown'),
                'confidence' => $this->string($rule, 'confidence', 'unknown'),
                'source_type' => $this->string($rule, 'source_type', 'curated'),
                'notes' => $this->nullableString($rule, 'notes'),
                'conditions_json' => $this->json($rule['conditions'] ?? null),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return count($availability);
    }

    /**
     * @param  list<array<string, mixed>>  $planners
     * @param  array<string, int>  $milestoneIds
     * @param  array<string, int>  $archetypeIds
     */
    private function syncPlanners(
        ConnectionInterface $db,
        int $trackId,
        array $planners,
        array $milestoneIds,
        array $archetypeIds
    ): int {
        $db->table('game_planners')->where('track_id', $trackId)->delete();
        $plannerItemCount = 0;

        foreach ($planners as $planner) {
            $archetypeKey = $this->requiredString($planner, 'archetype');
            if (! isset($archetypeIds[$archetypeKey])) {
                throw new RuntimeException("Unknown planner archetype: {$archetypeKey}");
            }
            $now = now();
            $status = $this->string($planner, 'status', 'draft');
            $plannerId = (int) $db->table('game_planners')->insertGetId([
                'track_id' => $trackId,
                'archetype_id' => $archetypeIds[$archetypeKey],
                'planner_key' => $this->requiredString($planner, 'key'),
                'name' => $this->requiredString($planner, 'name'),
                'description' => $this->nullableString($planner, 'description'),
                'status' => $status,
                'version' => $this->string($planner, 'version', '1'),
                'published_at' => $status === 'published' ? $now : null,
                'metadata_json' => $this->json($planner['metadata'] ?? null),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($this->list($planner, 'steps') as $step) {
                $milestoneKey = $this->requiredString($step, 'milestone');
                if (! isset($milestoneIds[$milestoneKey])) {
                    throw new RuntimeException("Unknown planner milestone: {$milestoneKey}");
                }
                $stepId = (int) $db->table('game_planner_steps')->insertGetId([
                    'planner_id' => $plannerId,
                    'milestone_id' => $milestoneIds[$milestoneKey],
                    'title' => $this->nullableString($step, 'title'),
                    'notes' => $this->nullableString($step, 'notes'),
                    'sort_order' => (int) ($step['order'] ?? 0),
                    'metadata_json' => $this->json($step['metadata'] ?? null),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                foreach ($this->list($step, 'items') as $item) {
                    $globalId = $this->requiredString($item, 'item');
                    $this->assertItemExists($globalId);
                    $db->table('game_planner_step_items')->insert([
                        'step_id' => $stepId,
                        'item_global_id' => $globalId,
                        'slot_type' => $this->string($item, 'slot', 'weapon'),
                        'recommendation_tier' => $this->string($item, 'tier', 'alternative'),
                        'priority' => (int) ($item['priority'] ?? 100),
                        'quantity' => (int) ($item['quantity'] ?? 1),
                        'notes' => $this->nullableString($item, 'notes'),
                        'source_url' => $this->nullableString($item, 'source_url'),
                        'conditions_json' => $this->json($item['conditions'] ?? null),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $plannerItemCount++;
                }
            }
        }

        return $plannerItemCount;
    }

    private function assertItemExists(string $globalId): void
    {
        $connection = (string) config('game-data.connection', config('database.default'));
        if (! DB::connection($connection)->table('items')->where('global_id', $globalId)->exists()) {
            throw new RuntimeException("Planner references an unknown item: {$globalId}");
        }
    }

    /**
     * @param  array<string, mixed>  $source
     * @return array<string, mixed>
     */
    private function requiredArray(array $source, string $key): array
    {
        $value = $source[$key] ?? null;
        if (! is_array($value) || array_is_list($value)) {
            throw new RuntimeException("{$key} must be an object.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $source
     * @return list<array<string, mixed>>
     */
    private function list(array $source, string $key): array
    {
        $value = $source[$key] ?? [];
        if (! is_array($value) || ! array_is_list($value)) {
            throw new RuntimeException("{$key} must be an array.");
        }

        foreach ($value as $entry) {
            if (! is_array($entry) || array_is_list($entry)) {
                throw new RuntimeException("Every {$key} entry must be an object.");
            }
        }

        /** @var list<array<string, mixed>> $value */
        return $value;
    }

    /** @param array<string, mixed> $source */
    private function requiredString(array $source, string $key): string
    {
        $value = trim((string) ($source[$key] ?? ''));
        if ($value === '') {
            throw new RuntimeException("{$key} is required.");
        }

        return $value;
    }

    /** @param array<string, mixed> $source */
    private function string(array $source, string $key, string $default): string
    {
        $value = trim((string) ($source[$key] ?? $default));

        return $value === '' ? $default : $value;
    }

    /** @param array<string, mixed> $source */
    private function nullableString(array $source, string $key): ?string
    {
        $value = trim((string) ($source[$key] ?? ''));

        return $value === '' ? null : $value;
    }

    /**
     * @param  array<string, mixed>  $source
     * @return list<string>
     */
    private function stringList(array $source, string $key): array
    {
        $value = $source[$key] ?? [];
        if (! is_array($value) || ! array_is_list($value)) {
            throw new RuntimeException("{$key} must be an array of strings.");
        }

        return array_map(static fn (mixed $item): string => (string) $item, $value);
    }

    private function json(mixed $value): ?string
    {
        if ($value === null || $value === []) {
            return null;
        }

        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
