<?php

namespace App\Services\GameData;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use stdClass;

class GamePlannerService
{
    public function __construct(
        private readonly GameAssetService $assets,
        private readonly GameDataCache $cache,
        private readonly GameLoadoutAssembler $loadouts,
    ) {}

    /** @var list<string> */
    private const REQUIRED_TABLES = [
        'game_progression_tracks',
        'game_progression_milestones',
        'game_build_archetypes',
        'game_planners',
        'game_planner_steps',
        'game_planner_step_items',
        'game_item_unlock_rules',
        'game_item_unlock_conditions',
        'game_reforge_profiles',
    ];

    public function isReady(): bool
    {
        foreach (self::REQUIRED_TABLES as $table) {
            if (! Schema::hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    /** @return array<int, array<string, mixed>> */
    public function archetypes(): array
    {
        return $this->cache->remember('planner:archetypes', fn (): array => $this->loadArchetypes());
    }

    /** @return array<int, array<string, mixed>> */
    private function loadArchetypes(): array
    {
        $rows = DB::table('game_build_archetypes as a')
            ->leftJoin('game_build_archetypes as parent', 'parent.id', '=', 'a.parent_id')
            ->select([
                'a.id', 'a.archetype_key', 'a.name', 'a.kind', 'a.damage_class_key', 'a.description',
                'a.sort_order', 'a.metadata_json', 'parent.archetype_key as parent_key',
            ])
            ->selectSub(
                DB::table('game_planners')->selectRaw('COUNT(*)')->whereColumn('game_planners.archetype_id', 'a.id'),
                'planners_count'
            )
            ->where('a.is_active', true)->orderByRaw('a.parent_id IS NOT NULL')->orderBy('a.sort_order')->orderBy('a.name')
            ->get();

        return $rows->map(fn (stdClass $row): array => $this->decodeObject($row, ['metadata_json']))->values()->all();
    }

    /** @return array<int, non-empty-array<string, mixed>> */
    public function tracks(): array
    {
        return $this->cache->remember('planner:tracks', fn (): array => $this->loadTracks());
    }

    /** @return array<int, non-empty-array<string, mixed>> */
    private function loadTracks(): array
    {
        return DB::table('game_progression_tracks')->where('is_active', true)->orderBy('name')->get()
            ->map(function (stdClass $track): array {
                $trackData = (array) $track;
                $data = $this->decodeObject($track, ['mod_versions_json', 'metadata_json']);
                $data['milestones'] = DB::table('game_progression_milestones as m')
                    ->where('m.track_id', $trackData['id'])->orderBy('m.sort_order')->get()
                    ->map(fn (stdClass $milestone): array => $this->decodeObject(
                        $milestone,
                        ['requirements_json', 'metadata_json']
                    ));

                return $data;
            })->values()->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    public function planners(array $filters = []): array
    {
        $cacheKey = 'planner:list:'.sha1((string) json_encode($filters, JSON_THROW_ON_ERROR));

        return $this->cache->remember($cacheKey, fn (): array => $this->loadPlanners($filters));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function loadPlanners(array $filters): array
    {
        $query = DB::table('game_planners as p')
            ->join('game_progression_tracks as t', 't.id', '=', 'p.track_id')
            ->join('game_build_archetypes as a', 'a.id', '=', 'p.archetype_id')
            ->select([
                'p.planner_key', 'p.name', 'p.description', 'p.status', 'p.version', 'p.published_at',
                'p.metadata_json', 't.track_key', 't.name as track_name', 'a.archetype_key', 'a.name as archetype_name',
            ])
            ->selectSub(
                DB::table('game_planner_steps')->selectRaw('COUNT(*)')->whereColumn('game_planner_steps.planner_id', 'p.id'),
                'steps_count'
            );

        if ($status = $this->stringFilter($filters, 'status')) {
            $query->where('p.status', $status);
        }
        if ($track = $this->stringFilter($filters, 'track')) {
            $query->where('t.track_key', $track);
        }
        if ($archetype = $this->stringFilter($filters, 'archetype')) {
            $query->where('a.archetype_key', $archetype);
        }

        return $query->orderBy('t.name')->orderBy('a.sort_order')->orderBy('a.name')->get()
            ->map(fn (stdClass $row): array => $this->decodeObject($row, ['metadata_json']))->values()->all();
    }

    /** @return array<string, mixed>|null */
    public function planner(string $plannerKey, int $balance = 0): ?array
    {
        $balance = max(-100, min(100, $balance));

        return $this->cache->remember(
            'planner:detail:'.sha1($plannerKey.':'.$balance),
            fn (): ?array => $this->loadPlanner($plannerKey, $balance)
        );
    }

    /** @return array<string, mixed>|null */
    private function loadPlanner(string $plannerKey, int $balance): ?array
    {
        $planner = DB::table('game_planners as p')
            ->join('game_progression_tracks as t', 't.id', '=', 'p.track_id')
            ->join('game_build_archetypes as a', 'a.id', '=', 'p.archetype_id')
            ->where('p.planner_key', $plannerKey)
            ->first([
                'p.id', 'p.planner_key', 'p.name', 'p.description', 'p.status', 'p.version', 'p.published_at',
                'p.metadata_json', 't.track_key', 't.name as track_name', 't.difficulty_key',
                'a.archetype_key', 'a.name as archetype_name', 'a.kind as archetype_kind',
            ]);

        if (! $planner) {
            return null;
        }

        $plannerData = (array) $planner;
        $plannerMetadata = $this->decodeJsonValue($plannerData['metadata_json'] ?? null);
        $recommendationLimit = max(1, min(10, (int) ($plannerMetadata['recommendation_limit'] ?? 5)));
        $steps = DB::table('game_planner_steps as ps')
            ->join('game_progression_milestones as m', 'm.id', '=', 'ps.milestone_id')
            ->where('ps.planner_id', $plannerData['id'])->orderBy('ps.sort_order')->orderBy('m.sort_order')
            ->get([
                'ps.id', 'ps.title', 'ps.notes', 'ps.sort_order', 'ps.metadata_json',
                'm.milestone_key', 'm.name as milestone_name', 'm.description as milestone_description',
                'm.milestone_type', 'm.source_system', 'm.progression_value', 'm.requirements_json',
            ]);
        $stepIds = $steps->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all();
        $items = $stepIds === [] ? collect() : DB::table('game_planner_step_items')
            ->whereIn('step_id', $stepIds)->orderBy('slot_type')->orderBy('priority')->get();
        $summaryIds = array_values($items->pluck('item_global_id')->map(
            static fn (mixed $id): string => (string) $id
        )->unique()->values()->all());
        $summaries = $this->itemSummaries($summaryIds);
        $itemsByStep = $items->groupBy('step_id');

        $timeline = [];
        $currentBuild = null;
        foreach ($steps as $step) {
            $stepData = (array) $step;
            $data = $this->decodeObject($step, ['metadata_json', 'requirements_json']);
            $stepItems = $itemsByStep->get($stepData['id'], collect());
            $data['items'] = $stepItems->map(function (stdClass $item) use ($summaries): array {
                $itemData = (array) $item;
                $row = $this->decodeObject($item, ['conditions_json']);
                $row['item'] = $summaries[(string) $itemData['item_global_id']] ?? null;

                return $row;
            })->values()->all();
            $rankedItems = [];
            foreach (collect($data['items'])->groupBy('slot_type') as $roleItems) {
                $role = $roleItems->map(function (array $item) use ($balance): array {
                    $vector = $item['conditions_json']['score_vector'] ?? null;
                    $item['dynamic_score'] = is_array($vector)
                        ? $this->scoreVector($vector, $balance)
                        : (float) ($item['conditions_json']['score'] ?? 0);

                    return $item;
                })->sortByDesc('dynamic_score')->take($recommendationLimit)->values()->all();
                foreach ($role as $priority => $item) {
                    $item['priority'] = $priority + 1;
                    $item['recommendation_tier'] = $priority === 0 ? 'core' : 'alternative';
                    $rankedItems[] = $item;
                }
            }
            $data['items'] = $rankedItems;
            $currentBuild = $this->loadouts->assemble($rankedItems, $currentBuild, $balance);
            $data['build'] = $currentBuild;
            $timeline[] = $data;
        }

        $data = $this->decodeObject($planner, ['metadata_json']);
        unset($data['id']);
        $data['balance'] = $balance;
        $data['timeline'] = $timeline;

        return $data;
    }

    /** @param array<string, mixed> $vector */
    private function scoreVector(array $vector, int $balance): float
    {
        if ($balance <= 0) {
            $position = ($balance + 100) / 100;
            $offenseWeight = 0.35 + (0.75 - 0.35) * $position;
            $defenseWeight = 1.0 + (0.75 - 1.0) * $position;
            $utilityWeight = 0.45 + (0.5 - 0.45) * $position;
        } else {
            $position = $balance / 100;
            $offenseWeight = 0.75 + (1.0 - 0.75) * $position;
            $defenseWeight = 0.75 + (0.15 - 0.75) * $position;
            $utilityWeight = 0.5 + (0.3 - 0.5) * $position;
        }

        return (float) ($vector['offense'] ?? 0) * $offenseWeight
            + (float) ($vector['defense'] ?? 0) * $defenseWeight
            + (float) ($vector['utility'] ?? 0) * $utilityWeight;
    }

    /** @return array<string, mixed> */
    private function decodeJsonValue(mixed $value): array
    {
        if (! is_string($value) || $value === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, object>|null
     */
    public function candidates(string $archetypeKey, array $filters): ?LengthAwarePaginator
    {
        $archetype = DB::table('game_build_archetypes')->where('archetype_key', $archetypeKey)
            ->where('is_active', true)->first();
        if (! $archetype) {
            return null;
        }

        $archetypeData = (array) $archetype;
        $metadata = is_string($archetypeData['metadata_json'])
            ? (json_decode($archetypeData['metadata_json'], true) ?: [])
            : [];
        $combatClasses = $this->metadataStrings($metadata, 'combat_class_keys');
        $categories = $this->metadataStrings($metadata, 'category_keys');
        $properties = $this->metadataStrings($metadata, 'property_keys');
        $db = $this->catalogDatabase();
        $query = $db->table('items as i')->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->select([
                'i.id', 'i.global_id', 'i.display_name', 'i.internal_name', 'i.numeric_id', 'i.rarity_text',
                'i.tooltip', 'i.description', 'm.mod_key', 'm.name as mod_name',
            ]);

        if ($combatClasses !== [] || $categories !== [] || $properties !== []) {
            $query->where(function (Builder $rules) use ($combatClasses, $categories, $properties): void {
                if ($combatClasses !== []) {
                    $rules->orWhereExists(function (Builder $exists) use ($combatClasses): void {
                        $exists->selectRaw('1')->from('item_combat_classes as candidate_icc')
                            ->join('combat_classes as candidate_cc', 'candidate_cc.id', '=', 'candidate_icc.combat_class_id')
                            ->whereColumn('candidate_icc.item_id', 'i.id')->whereIn('candidate_cc.class_key', $combatClasses);
                    });
                }
                if ($categories !== []) {
                    $rules->orWhereExists(function (Builder $exists) use ($categories): void {
                        $exists->selectRaw('1')->from('item_categories as candidate_ic')
                            ->join('categories as candidate_c', 'candidate_c.id', '=', 'candidate_ic.category_id')
                            ->whereColumn('candidate_ic.item_id', 'i.id')->whereIn('candidate_c.category_key', $categories);
                    });
                }
                if ($properties !== []) {
                    $rules->orWhereExists(function (Builder $exists) use ($properties): void {
                        $exists->selectRaw('1')->from('item_properties as candidate_ip')
                            ->whereColumn('candidate_ip.item_id', 'i.id')->whereIn('candidate_ip.property_key', $properties)
                            ->where('candidate_ip.boolean_value', true);
                    });
                }
            });
        }

        if ($search = $this->stringFilter($filters, 'q')) {
            $query->where(function (Builder $searchQuery) use ($search): void {
                $searchQuery->whereLike('i.display_name', "%{$search}%")
                    ->orWhereLike('i.internal_name', "%{$search}%")
                    ->orWhereLike('i.global_id', "%{$search}%");
            });
        }
        if ($mod = $this->stringFilter($filters, 'mod')) {
            $query->where('m.mod_key', $mod);
        }

        $perPage = min(max(1, (int) ($filters['per_page'] ?? 25)), 100);
        $paginator = $query->orderBy('i.display_name')->orderBy('i.id')->paginate($perPage);
        $globalIds = array_values(collect($paginator->items())->map(
            static fn (object $item): string => (string) ((array) $item)['global_id']
        )->values()->all());
        $summaries = $this->itemSummaries($globalIds);
        $paginator->setCollection(collect($paginator->items())->map(
            static function (object $item) use ($summaries): object {
                $itemData = (array) $item;

                return (object) ($summaries[(string) $itemData['global_id']] ?? $itemData);
            }
        ));

        return $paginator;
    }

    /**
     * @param  list<string>  $globalIds
     * @return array<string, array<string, mixed>>
     */
    private function itemSummaries(array $globalIds): array
    {
        if ($globalIds === []) {
            return [];
        }

        $db = $this->catalogDatabase();
        $items = $db->table('items as i')->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->whereIn('i.global_id', $globalIds)
            ->get([
                'i.id', 'i.global_id', 'i.display_name', 'i.internal_name', 'i.numeric_id', 'i.rarity_text',
                'i.tooltip', 'i.description', 'm.mod_key', 'm.name as mod_name',
            ]);
        $itemIds = $items->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all();
        $stats = $db->table('item_stats')->whereIn('item_id', $itemIds)
            ->whereIn('stat_key', ['damage', 'defense', 'critical_chance', 'knockback', 'use_time', 'mana_cost'])
            ->orderBy('stat_key')->get()->groupBy('item_id');

        $globalIds = array_values($items->pluck('global_id')->map(
            static fn (mixed $id): string => (string) $id
        )->all());
        $assets = $this->assets->forItems($globalIds);

        return $items->mapWithKeys(function (stdClass $item) use ($stats, $assets): array {
            $row = (array) $item;
            $itemStats = $stats->get($row['id'], collect());
            $row['stats'] = $itemStats->mapWithKeys(static function (stdClass $stat): array {
                $statData = (array) $stat;

                return [(string) $statData['stat_key'] => $statData['numeric_value'] ?? $statData['text_value'] ?? $statData['raw_value']];
            })->all();
            $row['icon'] = $assets[(string) $row['global_id']] ?? null;
            unset($row['id']);

            return [(string) $row['global_id'] => $row];
        })->all();
    }

    private function catalogDatabase(): ConnectionInterface
    {
        return DB::connection((string) config('game-data.connection', config('database.default')));
    }

    /**
     * @param  list<string>  $jsonFields
     * @return array<string, mixed>
     */
    private function decodeObject(stdClass $value, array $jsonFields = []): array
    {
        $data = (array) $value;
        foreach ($jsonFields as $field) {
            if (isset($data[$field]) && is_string($data[$field])) {
                $data[$field] = json_decode($data[$field], true);
            }
        }

        return $data;
    }

    /** @param array<string, mixed> $filters */
    private function stringFilter(array $filters, string $key): ?string
    {
        $value = trim((string) ($filters[$key] ?? ''));

        return $value === '' ? null : $value;
    }

    /**
     * @param  array<mixed>  $metadata
     * @return list<string>
     */
    private function metadataStrings(array $metadata, string $key): array
    {
        $values = $metadata[$key] ?? [];
        if (! is_array($values)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            $values
        )));
    }
}
