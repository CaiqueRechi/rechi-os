<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

#[Signature('game-data:snapshot-planners {--disk=local}')]
#[Description('Store a recoverable JSON snapshot of generated planner tables')]
class SnapshotGamePlanners extends Command
{
    /** @var list<string> */
    private const TABLES = [
        'game_progression_tracks', 'game_progression_milestones', 'game_milestone_dependencies',
        'game_build_archetypes', 'game_item_archetypes', 'game_item_availability', 'game_planners',
        'game_planner_steps', 'game_planner_step_items',
    ];

    public function handle(): int
    {
        $snapshot = ['created_at' => now()->toIso8601String(), 'tables' => []];
        foreach (self::TABLES as $table) {
            $snapshot['tables'][$table] = DB::table($table)->get()->map(
                static fn (object $row): array => (array) $row
            )->all();
        }
        $path = 'game-data/snapshots/planners-'.now()->format('Ymd-His').'.json';
        Storage::disk((string) $this->option('disk'))->put(
            $path,
            (string) json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
        $this->info("Snapshot stored at {$path}.");

        return self::SUCCESS;
    }
}
