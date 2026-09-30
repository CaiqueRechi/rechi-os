<?php

namespace App\Console\Commands;

use App\Services\GameData\GameDataCache;
use App\Services\GameData\GameIconImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Signature('game-data:repair-icon-metadata {--limit=0}')]
#[Description('Detect vertical Calamity icon animations and store frame metadata')]
class RepairGameIconMetadata extends Command
{
    public function handle(GameIconImporter $importer, GameDataCache $cache): int
    {
        try {
            $result = $importer->repairAnimationMetadata(max(0, (int) $this->option('limit')));
            if ($result['updated'] > 0) {
                $cache->bump();
            }
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->table(['Metric', 'Value'], collect($result)->map(
            static fn (int $value, string $key): array => [$key, $value]
        )->values()->all());

        return $result['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
