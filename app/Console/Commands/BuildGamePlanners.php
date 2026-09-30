<?php

namespace App\Console\Commands;

use App\Services\GameData\GamePlannerBuilder;
use App\Services\GameData\GamePlannerDefinitionImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Signature('game-data:build-planners {--track=terraria-calamity-auto-v1} {--definitions= : Definition JSON path}')]
#[Description('Generate game planner timelines from catalog facts and scoring rules')]
class BuildGamePlanners extends Command
{
    public function handle(GamePlannerDefinitionImporter $importer, GamePlannerBuilder $builder): int
    {
        $path = (string) ($this->option('definitions') ?: config('game-data.planner_definitions_path'));

        try {
            $importer->import($path, true);
            $result = $builder->build((string) $this->option('track'));
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
