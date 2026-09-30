<?php

namespace App\Services\GameData;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use stdClass;

class GameAssetService
{
    public function isReady(): bool
    {
        return Schema::hasTable('game_item_assets');
    }

    /**
     * @param  list<string>  $globalIds
     * @return array<string, array<string, mixed>>
     */
    public function forItems(array $globalIds): array
    {
        if (! $this->isReady() || $globalIds === []) {
            return [];
        }

        return DB::table('game_item_assets')->whereIn('item_global_id', $globalIds)
            ->where('asset_type', 'icon')->where('variant', 'default')->where('status', 'ready')
            ->get()->mapWithKeys(function (stdClass $asset): array {
                $row = (array) $asset;
                $row['url'] = Storage::disk((string) $row['disk'])->url((string) $row['path']);
                if (is_string($row['metadata_json'] ?? null)) {
                    $row['metadata_json'] = json_decode($row['metadata_json'], true);
                }

                return [(string) $row['item_global_id'] => $row];
            })->all();
    }

    /** @return array<string, mixed>|null */
    public function forItem(string $globalId): ?array
    {
        return $this->forItems([$globalId])[$globalId] ?? null;
    }
}
