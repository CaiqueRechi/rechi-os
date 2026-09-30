<?php

namespace App\Console\Commands;

use App\Services\GameData\GameDataCache;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('game-data:normalize-versions {--dry-run}')]
#[Description('Normalize Terraria and Calamity version metadata without rebuilding the catalog')]
class NormalizeGameDataVersions extends Command
{
    public function handle(GameDataCache $cache): int
    {
        $db = DB::connection((string) config('game-data.connection', config('database.default')));
        $terrariaVersion = (string) config('game-data.versions.terraria');
        $calamityVersion = (string) config('game-data.versions.calamity');
        $revision = (string) config('game-data.icons.calamity_source_revision');

        try {
            $calamityModId = $db->table('mods')->where('mod_key', 'calamity')->value('id');
            $terrariaModId = $db->table('mods')->where('mod_key', 'terraria')->value('id');
            if ($calamityModId === null || $terrariaModId === null) {
                $this->error('Required Terraria and Calamity mod rows were not found.');

                return self::FAILURE;
            }
            $counts = [
                'calamity_items' => $db->table('items')->where('mod_id', $calamityModId)->count(),
                'terraria_items' => $db->table('items')->where('mod_id', $terrariaModId)->count(),
            ];
            if (! $this->option('dry-run')) {
                $db->transaction(function () use (
                    $db, $calamityModId, $terrariaModId, $calamityVersion, $terrariaVersion, $revision
                ): void {
                    $db->table('items')->where('mod_id', $calamityModId)->update([
                        'game_version' => $terrariaVersion,
                        'mod_version' => $calamityVersion,
                    ]);
                    $db->table('items')->where('mod_id', $terrariaModId)->update([
                        'game_version' => $terrariaVersion,
                    ]);
                    $db->table('mod_versions')->where('mod_id', $calamityModId)->update([
                        'version' => $calamityVersion,
                        'source_revision' => $revision,
                    ]);
                    $db->table('game_versions')->where('game_id', $db->table('mods')->where('id', $terrariaModId)->value('game_id'))
                        ->where('is_current', true)->update(['version' => $terrariaVersion]);
                });
                $cache->bump();
            }
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->table(['Target', 'Rows', 'Version'], [
            ['Terraria items', $counts['terraria_items'], $terrariaVersion],
            ['Calamity items', $counts['calamity_items'], $calamityVersion],
        ]);

        return self::SUCCESS;
    }
}
