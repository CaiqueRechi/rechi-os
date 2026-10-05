<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

#[Signature('game-data:audit {--json}')]
#[Description('Report catalog, acquisition, planner and icon coverage')]
class AuditGameData extends Command
{
    public function handle(): int
    {
        $connection = (string) config('game-data.connection', config('database.default'));
        $db = DB::connection($connection);
        $catalogSchema = Schema::connection($connection);
        $items = $catalogSchema->hasTable('items') ? $db->table('items')->count() : 0;
        $metrics = [
            'items' => $items,
            'items_with_stats' => $catalogSchema->hasTable('item_stats')
                ? $db->table('item_stats')->distinct('item_id')->count('item_id') : 0,
            'items_with_acquisition' => $catalogSchema->hasTable('acquisition_methods')
                ? $db->table('acquisition_methods')->whereNotNull('item_id')->distinct('item_id')->count('item_id') : 0,
            'unresolved_recipe_ingredients' => $catalogSchema->hasTable('recipe_ingredients')
                ? $db->table('recipe_ingredients')->whereNull('ingredient_item_id')->whereNull('recipe_group_id')->count() : 0,
            'unresolved_drops' => $catalogSchema->hasTable('drops')
                ? $db->table('drops')->whereNull('item_id')->orWhere(function ($query): void {
                    $query->whereNull('npc_id')->whereNotNull('unresolved_source_name');
                })->count() : 0,
            'icons' => Schema::hasTable('game_item_assets')
                ? DB::table('game_item_assets')->where('status', 'ready')->count() : 0,
            'known_availability' => Schema::hasTable('game_item_availability')
                ? DB::table('game_item_availability')->where('confidence', '!=', 'unknown')->count() : 0,
            'planners' => Schema::hasTable('game_planners') ? DB::table('game_planners')->count() : 0,
            'planner_steps' => Schema::hasTable('game_planner_steps') ? DB::table('game_planner_steps')->count() : 0,
            'recommendations' => Schema::hasTable('game_planner_step_items')
                ? DB::table('game_planner_step_items')->count() : 0,
        ];
        $metrics['icon_coverage_percent'] = $items > 0 ? round($metrics['icons'] / $items * 100, 2) : 0.0;
        $metrics['availability_coverage_percent'] = $items > 0
            ? round($metrics['known_availability'] / $items * 100, 2) : 0.0;

        if ($this->option('json')) {
            $this->line((string) json_encode($metrics, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->table(['Metric', 'Value'], collect($metrics)->map(
                static fn (int|float $value, string $key): array => [$key, $value]
            )->values()->all());
        }

        return self::SUCCESS;
    }
}
