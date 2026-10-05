<?php

namespace App\Console\Commands;

use App\Services\GameData\GameDataCache;
use App\Services\GameData\GamePlannerDefinitionImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Signature('game-data:import-planners {path?} {--replace : Replace the selected progression track before importing}')]
#[Description('Import versioned progression, class and planner definitions')]
class ImportGamePlannerDefinitions extends Command
{
    public function handle(GamePlannerDefinitionImporter $importer, GameDataCache $cache): int
    {
        $path = (string) ($this->argument('path') ?: config('game-data.planner_definitions_path'));

        try {
            $result = $importer->import($path, (bool) $this->option('replace'));
            $cache->bump();
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->table(['Metric', 'Value'], collect($result)->map(
            static fn (int|string $value, string $key): array => [$key, (string) $value]
        )->values()->all());

        return self::SUCCESS;
    }
}
