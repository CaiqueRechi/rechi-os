<?php

namespace App\Services\GameData;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class GameCatalogService
{
    /** @var list<string> */
    private const REQUIRED_TABLES = ['games', 'mods', 'items', 'recipes', 'npcs', 'drops'];

    private readonly string $connectionName;

    public function __construct()
    {
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
                'i.slug', 'i.game_version', 'i.mod_version', 'i.rarity_text',
                'g.game_key', 'g.name as game_name', 'm.mod_key', 'm.name as mod_name',
            ]);

        $this->applyItemFilters($query, $filters);
        $sorts = ['name' => 'i.display_name', 'global_id' => 'i.global_id', 'rarity' => 'i.rarity_text'];
        $sort = $sorts[(string) ($filters['sort'] ?? 'name')] ?? $sorts['name'];
        $direction = ($filters['direction'] ?? 'asc') === 'desc' ? 'desc' : 'asc';

        return $query->orderBy($sort, $direction)->orderBy('i.id')->paginate($this->perPage($filters));
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

        return [
            'item' => $item,
            'stats' => $db->table('item_stats')->where('item_id', $itemId)->orderBy('stat_key')->get(),
            'properties' => $db->table('item_properties')->where('item_id', $itemId)->orderBy('property_key')->get(),
            'categories' => $db->table('categories as c')->join('item_categories as ic', 'ic.category_id', '=', 'c.id')
                ->where('ic.item_id', $itemId)->orderBy('c.name')->get(['c.category_key', 'c.name']),
            'combat_classes' => $db->table('combat_classes as cc')->join('item_combat_classes as icc', 'icc.combat_class_id', '=', 'cc.id')
                ->where('icc.item_id', $itemId)->orderBy('cc.name')->get(['cc.class_key', 'cc.name']),
            'tags' => $db->table('tags as t')->join('item_tags as it', 'it.tag_id', '=', 't.id')
                ->where('it.item_id', $itemId)->orderBy('t.name')->get(['t.tag_key', 't.name']),
            'progression' => $db->table('progression_stages as ps')->join('item_progression as ip', 'ip.progression_stage_id', '=', 'ps.id')
                ->where('ip.item_id', $itemId)->orderBy('ps.sort_order')
                ->get(['ps.global_id', 'ps.name', 'ps.sort_order', 'ip.confidence', 'ip.requirement_type', 'ip.requirement_json']),
            'recipes' => $this->recipesForResult($itemId),
            'used_in_recipes' => $this->recipesUsingIngredient($itemId),
            'drops' => $this->dropsForItem($itemId),
            'acquisition_methods' => $db->table('acquisition_methods')->where('item_id', $itemId)->orderBy('method_type')->get(),
            'relationships' => $db->table('item_relationships as ir')->join('items as target', 'target.id', '=', 'ir.target_item_id')
                ->where('ir.source_item_id', $itemId)->orderBy('ir.relationship_type')->orderBy('target.display_name')
                ->get(['ir.relationship_type', 'target.global_id', 'target.display_name', 'ir.metadata_json']),
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
    }

    private function recipesForResult(int $itemId): mixed
    {
        return $this->database()->table('recipes as r')->where('r.result_item_id', $itemId)
            ->orderBy('r.is_historical')->orderBy('r.id')
            ->get(['r.id', 'r.global_id', 'r.result_amount', 'r.recipe_source', 'r.version', 'r.is_historical']);
    }

    private function recipesUsingIngredient(int $itemId): mixed
    {
        return $this->database()->table('recipe_ingredients as ri')->join('recipes as r', 'r.id', '=', 'ri.recipe_id')
            ->leftJoin('items as result', 'result.id', '=', 'r.result_item_id')->where('ri.ingredient_item_id', $itemId)
            ->orderBy('result.display_name')->get([
                'r.global_id', 'result.global_id as result_global_id', 'result.display_name as result_name',
                'r.unresolved_result_name', 'ri.amount', 'r.recipe_source', 'r.version', 'r.is_historical',
            ]);
    }

    private function dropsForItem(int $itemId): mixed
    {
        return $this->database()->table('drops as d')->leftJoin('npcs as n', 'n.id', '=', 'd.npc_id')
            ->leftJoin('items as source_item', 'source_item.id', '=', 'd.source_item_id')->where('d.item_id', $itemId)
            ->orderBy('n.display_name')->get([
                'd.global_id', 'd.source_type', 'n.global_id as npc_global_id', 'n.display_name as npc_name',
                'source_item.global_id as source_item_global_id', 'source_item.display_name as source_item_name',
                'd.unresolved_source_name', 'd.quantity_min', 'd.quantity_max', 'd.chance',
                'd.chance_raw', 'd.difficulty', 'd.condition_text', 'd.conditions_json',
            ]);
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
