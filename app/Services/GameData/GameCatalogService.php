<?php

namespace App\Services\GameData;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use stdClass;

class GameCatalogService
{
    /** @var list<string> */
    private const REQUIRED_TABLES = ['games', 'mods', 'items', 'recipes', 'npcs', 'drops'];

    private readonly string $connectionName;

    public function __construct(
        private readonly GameAssetService $assets,
        private readonly GameDataCache $cache,
    ) {
        $this->connectionName = (string) config('game-data.connection', config('database.default'));
    }

    public function isReady(): bool
    {
        $schema = Schema::connection($this->connectionName);

        foreach (self::REQUIRED_TABLES as $table) {
            if (! $schema->hasTable($table)) {
                return false;
            }
        }

        return true;
    }

    /** @return array<string, mixed> */
    public function overview(): array
    {
        return $this->cache->remember('catalog:overview', fn (): array => $this->loadOverview());
    }

    /** @return array<string, mixed> */
    private function loadOverview(): array
    {
        $db = $this->database();
        $games = $db->table('games as g')
            ->select(['g.id', 'g.game_key', 'g.name'])
            ->selectSub($db->table('mods')->selectRaw('COUNT(*)')->whereColumn('mods.game_id', 'g.id'), 'mods_count')
            ->selectSub($db->table('items')->selectRaw('COUNT(*)')->whereColumn('items.game_id', 'g.id'), 'items_count')
            ->selectSub($db->table('npcs')->selectRaw('COUNT(*)')->whereColumn('npcs.game_id', 'g.id'), 'npcs_count')
            ->orderBy('g.name')
            ->get();

        $mods = $db->table('mods as m')
            ->join('games as g', 'g.id', '=', 'm.game_id')
            ->leftJoin('items as i', 'i.mod_id', '=', 'm.id')
            ->select(['m.id', 'm.mod_key', 'm.namespace', 'm.name', 'm.is_base_game', 'g.game_key'])
            ->selectRaw('COUNT(i.id) AS items_count')
            ->groupBy('m.id', 'm.mod_key', 'm.namespace', 'm.name', 'm.is_base_game', 'g.game_key')
            ->orderBy('g.game_key')->orderByDesc('m.is_base_game')->orderBy('m.name')
            ->get();

        return [
            'games' => $games,
            'mods' => $mods,
            'totals' => [
                'games' => $db->table('games')->count(),
                'mods' => $db->table('mods')->count(),
                'items' => $db->table('items')->count(),
                'npcs' => $db->table('npcs')->count(),
                'recipes' => $db->table('recipes')->count(),
                'drops' => $db->table('drops')->count(),
                'icons' => $this->assets->isReady() ? DB::table('game_item_assets')->where('status', 'ready')->count() : 0,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, object>
     */
    public function items(array $filters): LengthAwarePaginator
    {
        $query = $this->database()->table('items as i')
            ->join('games as g', 'g.id', '=', 'i.game_id')
            ->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->select([
                'i.id', 'i.global_id', 'i.numeric_id', 'i.internal_name', 'i.display_name',
                'i.slug', 'i.game_version', 'i.mod_version', 'i.rarity_text', 'i.tooltip', 'i.description',
                'g.game_key', 'g.name as game_name', 'm.mod_key', 'm.name as mod_name',
            ]);

        $this->applyItemFilters($query, $filters);
        $sorts = ['name' => 'i.display_name', 'global_id' => 'i.global_id', 'rarity' => 'i.rarity_text'];
        $sort = $sorts[(string) ($filters['sort'] ?? 'name')] ?? $sorts['name'];
        $direction = ($filters['direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        $paginator = $query->orderBy($sort, $direction)->orderBy('i.id')->paginate($this->perPage($filters));
        $globalIds = array_values(collect($paginator->items())->map(
            static fn (object $item): string => (string) ((array) $item)['global_id']
        )->all());
        $itemIds = array_values(collect($paginator->items())->map(
            static fn (object $item): int => (int) ((array) $item)['id']
        )->all());
        $assets = $this->assets->forItems($globalIds);
        $stats = $itemIds === [] ? collect() : $this->database()->table('item_stats')->whereIn('item_id', $itemIds)
            ->get(['item_id', 'stat_key', 'numeric_value', 'text_value', 'raw_value'])->groupBy('item_id');
        $paginator->setCollection(collect($paginator->items())->map(static function (object $item) use ($assets, $stats): object {
            $row = (array) $item;
            $row['icon'] = $assets[(string) $row['global_id']] ?? null;
            $row['stats'] = collect($stats->get((int) $row['id'], collect()))->mapWithKeys(
                static function (stdClass $stat): array {
                    return [(string) $stat->stat_key => $stat->numeric_value ?? $stat->text_value ?? $stat->raw_value];
                }
            )->all();

            return (object) $row;
        }));

        return $paginator;
    }

    /** @return array<string, mixed>|null */
    public function item(string $globalId): ?array
    {
        $db = $this->database();
        $item = $db->table('items as i')
            ->join('games as g', 'g.id', '=', 'i.game_id')
            ->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->where('i.global_id', $globalId)
            ->select(['i.*', 'g.game_key', 'g.name as game_name', 'm.mod_key', 'm.name as mod_name', 'm.namespace as mod_namespace'])
            ->first();

        if (! $item) {
            return null;
        }

        $itemId = (int) $item->id;
        $recipes = collect($this->recipesForResult($itemId));
        $usedInRecipes = collect($this->recipesUsingIngredient($itemId));
        $drops = $this->dropsForItem($itemId);
        $stats = $db->table('item_stats')->where('item_id', $itemId)->orderBy('stat_key')->get();
        $properties = $db->table('item_properties')->where('item_id', $itemId)->orderBy('property_key')->get();
        $planner = $this->plannerData((string) $item->global_id);

        return [
            'item' => $this->objectWithDecodedJson($item, ['raw_json']),
            'icon' => $this->assets->forItem((string) $item->global_id),
            'stats' => $stats,
            'stats_map' => $stats->mapWithKeys(static function (stdClass $stat): array {
                $value = $stat->numeric_value ?? $stat->text_value ?? $stat->raw_value;

                return [(string) $stat->stat_key => ['value' => $value, 'unit' => $stat->unit]];
            }),
            'properties' => $properties->map(fn (stdClass $property): array => $this->objectWithDecodedJson($property)),
            'categories' => $db->table('categories as c')->join('item_categories as ic', 'ic.category_id', '=', 'c.id')
                ->where('ic.item_id', $itemId)->orderBy('c.name')->get(['c.category_key', 'c.name']),
            'combat_classes' => $db->table('combat_classes as cc')->join('item_combat_classes as icc', 'icc.combat_class_id', '=', 'cc.id')
                ->where('icc.item_id', $itemId)->orderBy('cc.name')->get(['cc.class_key', 'cc.name']),
            'tags' => $db->table('tags as t')->join('item_tags as it', 'it.tag_id', '=', 't.id')
                ->where('it.item_id', $itemId)->orderBy('t.name')->get(['t.tag_key', 't.name']),
            'progression' => $db->table('progression_stages as ps')->join('item_progression as ip', 'ip.progression_stage_id', '=', 'ps.id')
                ->where('ip.item_id', $itemId)->orderBy('ps.sort_order')
                ->get(['ps.global_id', 'ps.name', 'ps.sort_order', 'ip.confidence', 'ip.requirement_type', 'ip.requirement_json'])
                ->map(fn (stdClass $stage): array => $this->objectWithDecodedJson($stage, ['requirement_json'])),
            'recipes' => $recipes,
            'used_in_recipes' => $usedInRecipes,
            'drops' => $drops,
            'acquisition_methods' => $this->acquisitionMethods($itemId),
            'shops' => $this->shopsForItem($itemId),
            'relationships' => $db->table('item_relationships as ir')->join('items as target', 'target.id', '=', 'ir.target_item_id')
                ->where('ir.source_item_id', $itemId)->orderBy('ir.relationship_type')->orderBy('target.display_name')
                ->get(['ir.relationship_type', 'target.global_id', 'target.display_name', 'ir.metadata_json'])
                ->map(fn (stdClass $relationship): array => $this->objectWithDecodedJson($relationship, ['metadata_json'])),
            'related_from' => $db->table('item_relationships as ir')->join('items as source', 'source.id', '=', 'ir.source_item_id')
                ->where('ir.target_item_id', $itemId)->orderBy('ir.relationship_type')->orderBy('source.display_name')
                ->get(['ir.relationship_type', 'source.global_id', 'source.display_name', 'ir.metadata_json'])
                ->map(fn (stdClass $relationship): array => $this->objectWithDecodedJson($relationship, ['metadata_json'])),
            'sources' => $this->itemSources($itemId),
            'unlocked_when' => $planner['unlocked_when'],
            'planner' => $planner,
            'completeness' => [
                'has_stats' => $stats->isNotEmpty(),
                'has_classification' => $db->table('item_categories')->where('item_id', $itemId)->exists(),
                'has_acquisition' => $recipes->isNotEmpty() || $drops->isNotEmpty()
                    || $db->table('acquisition_methods')->where('item_id', $itemId)->exists(),
                'unresolved_recipe_ingredients' => $recipes->sum(
                    static function (array $recipe): int {
                        $recipeIngredients = $recipe['ingredients'] ?? [];
                        if (! is_iterable($recipeIngredients)) {
                            return 0;
                        }

                        $unresolved = 0;
                        foreach ($recipeIngredients as $ingredient) {
                            $row = is_object($ingredient) ? (array) $ingredient : $ingredient;
                            if (is_array($row) && ($row['item_global_id'] ?? null) === null) {
                                $unresolved++;
                            }
                        }

                        return $unresolved;
                    }
                ),
                'drop_chances_missing' => $drops->whereNull('chance')->count(),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, object>
     */
    public function recipes(array $filters): LengthAwarePaginator
    {
        $query = $this->database()->table('recipes as r')
            ->join('mods as m', 'm.id', '=', 'r.mod_id')
            ->leftJoin('items as result', 'result.id', '=', 'r.result_item_id')
            ->select([
                'r.id', 'r.global_id', 'r.result_amount', 'r.recipe_source', 'r.version',
                'r.is_historical', 'r.unresolved_result_name', 'm.mod_key',
                'result.global_id as result_global_id', 'result.display_name as result_name',
            ]);

        if ($itemGlobalId = $this->stringFilter($filters, 'item')) {
            $query->where(function (Builder $builder) use ($itemGlobalId): void {
                $builder->where('result.global_id', $itemGlobalId)
                    ->orWhereExists(function (Builder $ingredient) use ($itemGlobalId): void {
                        $ingredient->selectRaw('1')->from('recipe_ingredients as ri')
                            ->join('items as ingredient_item', 'ingredient_item.id', '=', 'ri.ingredient_item_id')
                            ->whereColumn('ri.recipe_id', 'r.id')->where('ingredient_item.global_id', $itemGlobalId);
                    });
            });
        }
        if ($mod = $this->stringFilter($filters, 'mod')) {
            $query->where('m.mod_key', $mod);
        }
        if (array_key_exists('historical', $filters)) {
            $query->where('r.is_historical', (bool) $filters['historical']);
        }

        return $query->orderBy('result.display_name')->orderBy('r.id')->paginate($this->perPage($filters));
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, object>
     */
    public function npcs(array $filters): LengthAwarePaginator
    {
        $db = $this->database();
        $query = $db->table('npcs as n')
            ->join('games as g', 'g.id', '=', 'n.game_id')
            ->join('mods as m', 'm.id', '=', 'n.mod_id')
            ->select([
                'n.id', 'n.global_id', 'n.numeric_id', 'n.internal_name', 'n.display_name',
                'n.slug', 'n.is_boss', 'n.is_friendly', 'n.biome', 'n.event_name',
                'g.game_key', 'm.mod_key', 'm.name as mod_name',
            ])
            ->selectSub($db->table('drops')->selectRaw('COUNT(*)')->whereColumn('drops.npc_id', 'n.id'), 'drops_count');

        if ($search = $this->stringFilter($filters, 'q')) {
            $query->where(function (Builder $builder) use ($search): void {
                $builder->whereLike('n.display_name', "%{$search}%")
                    ->orWhereLike('n.internal_name', "%{$search}%")
                    ->orWhereLike('n.global_id', "%{$search}%");
            });
        }
        if ($game = $this->stringFilter($filters, 'game')) {
            $query->where('g.game_key', $game);
        }
        if ($mod = $this->stringFilter($filters, 'mod')) {
            $query->where('m.mod_key', $mod);
        }
        if (array_key_exists('boss', $filters)) {
            $query->where('n.is_boss', (bool) $filters['boss']);
        }

        return $query->orderBy('n.display_name')->orderBy('n.id')->paginate($this->perPage($filters));
    }

    /** @return array<string, mixed>|null */
    public function npc(string $globalId): ?array
    {
        $db = $this->database();
        $npc = $db->table('npcs as n')->join('games as g', 'g.id', '=', 'n.game_id')->join('mods as m', 'm.id', '=', 'n.mod_id')
            ->where('n.global_id', $globalId)->select(['n.*', 'g.game_key', 'm.mod_key', 'm.name as mod_name'])->first();

        if (! $npc) {
            return null;
        }

        return [
            'npc' => $npc,
            'stats' => $db->table('npc_stats')->where('npc_id', $npc->id)->orderBy('stat_key')->get(),
            'properties' => $db->table('npc_properties')->where('npc_id', $npc->id)->orderBy('property_key')->get(),
            'drops' => $db->table('drops as d')->leftJoin('items as i', 'i.id', '=', 'd.item_id')->where('d.npc_id', $npc->id)
                ->orderBy('i.display_name')->get([
                    'd.global_id', 'i.global_id as item_global_id', 'i.display_name as item_name',
                    'd.unresolved_item_name', 'd.quantity_min', 'd.quantity_max', 'd.chance',
                    'd.chance_raw', 'd.difficulty', 'd.condition_text', 'd.conditions_json',
                ]),
        ];
    }

    /** @param array<string, mixed> $filters */
    private function applyItemFilters(Builder $query, array $filters): void
    {
        if ($search = $this->stringFilter($filters, 'q')) {
            $query->where(function (Builder $builder) use ($search): void {
                $builder->whereLike('i.display_name', "%{$search}%")->orWhereLike('i.internal_name', "%{$search}%")->orWhereLike('i.global_id', "%{$search}%");
            });
        }
        if ($game = $this->stringFilter($filters, 'game')) {
            $query->where('g.game_key', $game);
        }
        if ($mod = $this->stringFilter($filters, 'mod')) {
            $query->where('m.mod_key', $mod);
        }
        if ($rarity = $this->stringFilter($filters, 'rarity')) {
            $query->whereLike('i.rarity_text', "%{$rarity}%");
        }
        if ($category = $this->stringFilter($filters, 'category')) {
            $query->whereExists(function (Builder $exists) use ($category): void {
                $exists->selectRaw('1')->from('item_categories as filter_ic')->join('categories as filter_c', 'filter_c.id', '=', 'filter_ic.category_id')
                    ->whereColumn('filter_ic.item_id', 'i.id')->where('filter_c.category_key', $category);
            });
        }
        if ($combatClass = $this->stringFilter($filters, 'combat_class')) {
            $query->whereExists(function (Builder $exists) use ($combatClass): void {
                $exists->selectRaw('1')->from('item_combat_classes as filter_icc')->join('combat_classes as filter_cc', 'filter_cc.id', '=', 'filter_icc.combat_class_id')
                    ->whereColumn('filter_icc.item_id', 'i.id')->where('filter_cc.class_key', $combatClass);
            });
        }
        if ($progression = $this->stringFilter($filters, 'progression')) {
            $query->whereExists(function (Builder $exists) use ($progression): void {
                $exists->selectRaw('1')->from('item_progression as filter_ip')->join('progression_stages as filter_ps', 'filter_ps.id', '=', 'filter_ip.progression_stage_id')
                    ->whereColumn('filter_ip.item_id', 'i.id')->where('filter_ps.global_id', $progression);
            });
        }
        if ($slot = $this->stringFilter($filters, 'slot')) {
            if ($slot === 'weapon') {
                $query->whereExists(function (Builder $exists): void {
                    $exists->selectRaw('1')->from('item_stats as slot_stat')
                        ->whereColumn('slot_stat.item_id', 'i.id')->where('slot_stat.stat_key', 'damage')
                        ->where('slot_stat.numeric_value', '>', 0);
                });
            } elseif ($slot === 'accessory') {
                $query->whereExists(function (Builder $exists): void {
                    $exists->selectRaw('1')->from('item_categories as slot_ic')
                        ->join('categories as slot_category', 'slot_category.id', '=', 'slot_ic.category_id')
                        ->whereColumn('slot_ic.item_id', 'i.id')
                        ->whereIn('slot_category.category_key', ['accessory', 'accessory_items']);
                });
            } else {
                $bodySlot = match ($slot) {
                    'armor_head' => ['head', 'helmet'],
                    'armor_body' => ['body', 'shirt'],
                    'armor_legs' => ['legs', 'pants'],
                    default => [],
                };
                $query->whereExists(function (Builder $exists): void {
                    $exists->selectRaw('1')->from('item_categories as slot_ic')
                        ->join('categories as slot_category', 'slot_category.id', '=', 'slot_ic.category_id')
                        ->whereColumn('slot_ic.item_id', 'i.id')->where('slot_category.category_key', 'armor');
                })->whereExists(function (Builder $exists) use ($bodySlot): void {
                    $exists->selectRaw('1')->from('item_properties as slot_property')
                        ->whereColumn('slot_property.item_id', 'i.id')->where('slot_property.property_key', 'bodyslot')
                        ->where(function (Builder $values) use ($bodySlot): void {
                            foreach ($bodySlot as $value) {
                                $values->orWhereLike('slot_property.text_value', "%{$value}%")
                                    ->orWhereLike('slot_property.raw_value', "%{$value}%");
                            }
                        });
                });
            }
        }
    }

    /** @return list<array<string, mixed>> */
    private function recipesForResult(int $itemId): array
    {
        $recipes = $this->database()->table('recipes as r')
            ->join('mods as m', 'm.id', '=', 'r.mod_id')
            ->leftJoin('items as result', 'result.id', '=', 'r.result_item_id')
            ->where('r.result_item_id', $itemId)
            ->orderBy('r.is_historical')->orderBy('r.id')
            ->get([
                'r.id', 'r.global_id', 'r.result_amount', 'r.recipe_source', 'r.version', 'r.is_historical',
                'r.unresolved_result_name', 'r.raw_json', 'm.mod_key', 'result.global_id as result_global_id',
                'result.display_name as result_name',
            ]);

        return $this->hydrateRecipes($recipes);
    }

    /** @return list<array<string, mixed>> */
    private function recipesUsingIngredient(int $itemId): array
    {
        $recipes = $this->database()->table('recipe_ingredients as selected_ingredient')
            ->join('recipes as r', 'r.id', '=', 'selected_ingredient.recipe_id')
            ->join('mods as m', 'm.id', '=', 'r.mod_id')
            ->leftJoin('items as result', 'result.id', '=', 'r.result_item_id')
            ->where('selected_ingredient.ingredient_item_id', $itemId)
            ->orderBy('result.display_name')->get([
                'r.id', 'r.global_id', 'r.result_amount', 'r.recipe_source', 'r.version', 'r.is_historical',
                'r.unresolved_result_name', 'r.raw_json', 'm.mod_key', 'result.global_id as result_global_id',
                'result.display_name as result_name',
            ]);

        return $this->hydrateRecipes($recipes);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function dropsForItem(int $itemId): Collection
    {
        return $this->database()->table('drops as d')->leftJoin('npcs as n', 'n.id', '=', 'd.npc_id')
            ->leftJoin('items as source_item', 'source_item.id', '=', 'd.source_item_id')->where('d.item_id', $itemId)
            ->orderBy('n.display_name')->get([
                'd.global_id', 'd.source_type', 'n.global_id as npc_global_id', 'n.display_name as npc_name',
                'source_item.global_id as source_item_global_id', 'source_item.display_name as source_item_name',
                'd.unresolved_source_name', 'd.quantity_min', 'd.quantity_max', 'd.chance',
                'd.chance_raw', 'd.difficulty', 'd.condition_text', 'd.conditions_json', 'd.raw_json',
            ])->map(fn (stdClass $drop): array => $this->objectWithDecodedJson($drop, ['conditions_json', 'raw_json']));
    }

    /**
     * @param  Collection<int, stdClass>  $recipes
     * @return list<array<string, mixed>>
     */
    private function hydrateRecipes(Collection $recipes): array
    {
        if ($recipes->isEmpty()) {
            return [];
        }

        $db = $this->database();
        $recipeIds = $recipes->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all();
        $ingredients = $db->table('recipe_ingredients as ri')
            ->leftJoin('items as ingredient', 'ingredient.id', '=', 'ri.ingredient_item_id')
            ->leftJoin('recipe_groups as rg', 'rg.id', '=', 'ri.recipe_group_id')
            ->whereIn('ri.recipe_id', $recipeIds)->orderBy('ri.sort_order')->orderBy('ri.id')
            ->get([
                'ri.recipe_id', 'ri.amount', 'ri.sort_order', 'ri.unresolved_name',
                'ingredient.global_id as item_global_id', 'ingredient.display_name as item_name',
                'rg.group_key as recipe_group_key', 'rg.name as recipe_group_name',
            ])->groupBy('recipe_id');
        $stations = $db->table('recipe_stations as rs')
            ->join('crafting_stations as station', 'station.id', '=', 'rs.station_id')
            ->whereIn('rs.recipe_id', $recipeIds)->orderBy('station.name')
            ->get([
                'rs.recipe_id', 'station.station_key', 'station.name',
            ])->groupBy('recipe_id');
        $conditions = $db->table('recipe_conditions')->whereIn('recipe_id', $recipeIds)
            ->orderBy('id')->get()->groupBy('recipe_id');
        $changes = $db->table('recipe_changes as rc')->join('mods as m', 'm.id', '=', 'rc.mod_id')
            ->leftJoin('data_sources as ds', 'ds.id', '=', 'rc.data_source_id')
            ->whereIn('rc.target_recipe_id', $recipeIds)->orderBy('rc.id')
            ->get([
                'rc.target_recipe_id as recipe_id', 'rc.global_id', 'rc.change_type', 'rc.change_expression',
                'm.mod_key', 'ds.source_type', 'ds.source_url', 'ds.source_repository', 'ds.source_file',
            ])->groupBy('recipe_id');

        $result = [];
        foreach ($recipes as $recipe) {
            $recipeData = (array) $recipe;
            $id = (int) $recipeData['id'];
            $data = $this->objectWithDecodedJson($recipe, ['raw_json']);
            $data['ingredients'] = collect($ingredients->get($id, collect()))->values()->all();
            $data['stations'] = collect($stations->get($id, collect()))->values()->all();
            $data['conditions'] = collect($conditions->get($id, collect()))
                ->map(fn (stdClass $condition): array => $this->objectWithDecodedJson($condition, ['value_json']))->values()->all();
            $data['changes'] = collect($changes->get($id, collect()))->values()->all();
            $result[] = $data;
        }

        return $result;
    }

    /** @return Collection<int, array<string, mixed>> */
    private function acquisitionMethods(int $itemId): Collection
    {
        return $this->database()->table('acquisition_methods as a')
            ->leftJoin('recipes as r', 'r.id', '=', 'a.recipe_id')
            ->leftJoin('drops as d', 'd.id', '=', 'a.drop_id')
            ->leftJoin('npcs as n', 'n.id', '=', 'a.npc_id')
            ->where('a.item_id', $itemId)->orderBy('a.method_type')->orderBy('a.id')
            ->get([
                'a.global_id', 'a.method_type', 'a.description', 'a.conditions_json', 'a.raw_json',
                'r.global_id as recipe_global_id', 'd.global_id as drop_global_id',
                'n.global_id as npc_global_id', 'n.display_name as npc_name',
            ])->map(fn (stdClass $method): array => $this->objectWithDecodedJson($method, ['conditions_json', 'raw_json']));
    }

    /** @return Collection<int, array<string, mixed>> */
    private function shopsForItem(int $itemId): Collection
    {
        return $this->database()->table('shop_items as si')
            ->join('shops as s', 's.id', '=', 'si.shop_id')
            ->leftJoin('npcs as vendor', 'vendor.id', '=', 's.vendor_npc_id')
            ->leftJoin('items as currency', 'currency.id', '=', 'si.currency_item_id')
            ->where('si.item_id', $itemId)->orderBy('vendor.display_name')->orderBy('s.name')
            ->get([
                's.global_id as shop_global_id', 's.name as shop_name', 'vendor.global_id as vendor_global_id',
                'vendor.display_name as vendor_name', 'si.price', 'currency.global_id as currency_global_id',
                'currency.display_name as currency_name', 's.conditions_json as shop_conditions_json',
                'si.conditions_json as item_conditions_json',
            ])->map(fn (stdClass $shop): array => $this->objectWithDecodedJson(
                $shop,
                ['shop_conditions_json', 'item_conditions_json']
            ));
    }

    /** @return Collection<int, stdClass> */
    private function itemSources(int $itemId): Collection
    {
        return $this->database()->table('item_data_sources as ids')
            ->join('data_sources as ds', 'ds.id', '=', 'ids.data_source_id')
            ->where('ids.item_id', $itemId)->orderBy('ids.field_group')->orderBy('ds.source_key')
            ->get([
                'ids.field_group', 'ids.derivation_method', 'ds.source_key', 'ds.name', 'ds.source_type',
                'ds.source_url', 'ds.source_repository', 'ds.source_file', 'ds.source_version',
                'ds.source_revision', 'ds.retrieved_at',
            ]);
    }

    /** @return array<string, mixed> */
    private function plannerData(string $globalId): array
    {
        if (! Schema::hasTable('game_item_availability')) {
            return ['availability' => [], 'recommendations' => [], 'unlocked_when' => []];
        }

        $availability = DB::table('game_item_availability as a')
            ->join('game_progression_tracks as t', 't.id', '=', 'a.track_id')
            ->join('game_progression_milestones as m', 'm.id', '=', 'a.milestone_id')
            ->where('a.item_global_id', $globalId)->orderBy('t.name')->orderBy('m.sort_order')
            ->get([
                't.track_key', 't.name as track_name', 'm.milestone_key', 'm.name as milestone_name',
                'm.sort_order', 'a.availability_type', 'a.confidence', 'a.source_type', 'a.notes',
                'a.conditions_json',
            ])->map(fn (stdClass $row): array => $this->objectWithDecodedJson($row, ['conditions_json']));
        $recommendations = DB::table('game_planner_step_items as psi')
            ->join('game_planner_steps as ps', 'ps.id', '=', 'psi.step_id')
            ->join('game_planners as p', 'p.id', '=', 'ps.planner_id')
            ->join('game_build_archetypes as a', 'a.id', '=', 'p.archetype_id')
            ->join('game_progression_milestones as m', 'm.id', '=', 'ps.milestone_id')
            ->where('psi.item_global_id', $globalId)->orderBy('m.sort_order')->orderBy('psi.priority')
            ->get([
                'p.planner_key', 'p.name as planner_name', 'p.status', 'a.archetype_key', 'a.name as archetype_name',
                'm.milestone_key', 'm.name as milestone_name', 'psi.slot_type', 'psi.recommendation_tier',
                'psi.priority', 'psi.quantity', 'psi.notes', 'psi.source_url', 'psi.conditions_json',
            ])->map(fn (stdClass $row): array => $this->objectWithDecodedJson($row, ['conditions_json']));

        $unlockedWhen = collect();
        if (Schema::hasTable('game_item_unlock_rules') && Schema::hasTable('game_item_unlock_conditions')) {
            $rules = DB::table('game_item_unlock_rules as r')
                ->join('game_progression_tracks as t', 't.id', '=', 'r.track_id')
                ->where('r.item_global_id', $globalId)
                ->orderBy('r.progression_value')
                ->get([
                    'r.id', 't.track_key', 'r.method_key', 'r.method_type', 'r.label', 'r.confidence',
                    'r.progression_value', 'r.metadata_json',
                ]);
            $ruleIds = $rules->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all();
            $conditions = $ruleIds === [] ? collect() : DB::table('game_item_unlock_conditions')
                ->whereIn('unlock_rule_id', $ruleIds)->orderBy('sort_order')->get()->groupBy('unlock_rule_id');
            $unlockedWhen = $rules->map(function (stdClass $rule) use ($conditions): array {
                $row = $this->objectWithDecodedJson($rule, ['metadata_json']);
                $ruleId = (int) $row['id'];
                unset($row['id']);
                $row['conditions'] = $conditions->get($ruleId, collect())->map(
                    fn (stdClass $condition): array => $this->objectWithDecodedJson(
                        $condition,
                        ['value_json', 'metadata_json']
                    )
                )->values()->all();

                return $row;
            });
        }

        return [
            'availability' => $availability,
            'recommendations' => $recommendations,
            'unlocked_when' => $unlockedWhen->values()->all(),
        ];
    }

    /**
     * @param  list<string>  $jsonFields
     * @return array<string, mixed>
     */
    private function objectWithDecodedJson(stdClass $value, array $jsonFields = []): array
    {
        $data = (array) $value;

        foreach ($jsonFields as $field) {
            if (isset($data[$field]) && is_string($data[$field])) {
                $data[$field] = json_decode($data[$field], true);
            }
        }

        return $data;
    }

    private function database(): ConnectionInterface
    {
        return DB::connection($this->connectionName);
    }

    /** @param array<string, mixed> $filters */
    private function perPage(array $filters): int
    {
        return min(max(1, (int) ($filters['per_page'] ?? 25)), max(1, (int) config('game-data.max_per_page', 100)));
    }

    /** @param array<string, mixed> $filters */
    private function stringFilter(array $filters, string $key): ?string
    {
        $value = trim((string) ($filters[$key] ?? ''));

        return $value === '' ? null : $value;
    }
}
