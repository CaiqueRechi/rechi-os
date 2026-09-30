<?php

namespace App\Console\Commands;

use App\Services\GameData\GameDataCache;
use App\Services\GameData\GameIconImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

#[Signature('game-data:import-icons {--mod=all : all, calamity or terraria} {--calamity-repository= : Local CalamityModPublic checkout} {--limit=0} {--force} {--dry-run}')]
#[Description('Import item icons into configured application storage')]
class ImportGameIcons extends Command
{
    public function handle(GameIconImporter $importer, GameDataCache $cache): int
    {
        $mod = strtolower((string) $this->option('mod'));
        if (! in_array($mod, ['all', 'calamity', 'terraria'], true)) {
            $this->error('The --mod option must be all, calamity or terraria.');

            return self::INVALID;
        }

        try {
            $result = $importer->import(
                $mod,
                $this->option('calamity-repository') ? (string) $this->option('calamity-repository') : null,
                max(0, (int) $this->option('limit')),
                (bool) $this->option('force'),
                (bool) $this->option('dry-run'),
            );
            if (! $this->option('dry-run') && $result['imported'] > 0) {
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
