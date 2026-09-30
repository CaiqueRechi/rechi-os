<?php

namespace App\Services\GameData;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;
use Throwable;

class GameIconImporter
{
    /** @return array<string, int> */
    public function import(string $mod, ?string $calamityRepository, int $limit, bool $force, bool $dryRun): array
    {
        if (! Schema::hasTable('game_item_assets')) {
            throw new RuntimeException('Asset tables are not installed. Run migrations first.');
        }

        $result = ['examined' => 0, 'imported' => 0, 'skipped' => 0, 'missing' => 0, 'failed' => 0];
        if ($mod === 'all' || $mod === 'calamity') {
            $result = $this->merge($result, $this->importCalamity($calamityRepository, $limit, $force, $dryRun));
        }
        if ($mod === 'all' || $mod === 'terraria') {
            $remaining = $limit > $result['examined'] ? $limit - $result['examined'] : 0;
            if ($limit === 0 || $remaining > 0) {
                $result = $this->merge($result, $this->importTerraria($remaining, $force, $dryRun));
            }
        }

        return $result;
    }

    /** @return array<string, int> */
    private function importCalamity(?string $repository, int $limit, bool $force, bool $dryRun): array
    {
        $result = ['examined' => 0, 'imported' => 0, 'skipped' => 0, 'missing' => 0, 'failed' => 0];
        $repository = $repository ?: $this->nullableConfig('game-data.icons.calamity_repository');
        $index = $repository === null ? [] : $this->pngIndex($repository);
        $query = $this->catalogDatabase()->table('items as i')->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->where('m.mod_key', 'calamity')->orderBy('i.id')
            ->get(['i.global_id', 'i.internal_name', 'i.raw_json']);

        foreach ($query as $item) {
            if ($limit > 0 && $result['examined'] >= $limit) {
                break;
            }
            $result['examined']++;
            $row = (array) $item;
            $globalId = (string) $row['global_id'];
            if (! $force && $this->assetExists($globalId)) {
                $result['skipped']++;

                continue;
            }

            $raw = is_string($row['raw_json']) ? json_decode($row['raw_json'], true) : [];
            $sourceFile = is_array($raw) ? (string) ($raw['source_file'] ?? '') : '';
            $relativePath = preg_replace('/\.cs$/i', '.png', str_replace('\\', '/', $sourceFile)) ?: '';
            $localPath = $repository !== null && $relativePath !== '' ? $repository.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relativePath) : null;
            if ($localPath === null || ! is_file($localPath)) {
                $localPath = $index[strtolower((string) $row['internal_name']).'.png'] ?? null;
            }

            try {
                $bytes = null;
                $sourceUrl = null;
                if ($localPath !== null && is_file($localPath)) {
                    $bytes = file_get_contents($localPath);
                    $sourceUrl = rtrim((string) config('game-data.icons.calamity_raw_base_url'), '/').'/'.$relativePath;
                } elseif ($repository === null && $relativePath !== '') {
                    $sourceUrl = rtrim((string) config('game-data.icons.calamity_raw_base_url'), '/').'/'.$relativePath;
                    $response = Http::withUserAgent('rechi-os-game-data/1.0')->timeout(20)
                        ->retry(2, 250, throw: false)->get($sourceUrl);
                    if ($response->successful()) {
                        $bytes = $response->body();
                    }
                }
                if (! is_string($bytes) || $bytes === '') {
                    $result['missing']++;

                    continue;
                }
                if (! $dryRun) {
                    $this->store($globalId, $bytes, 'calamity_repository', $sourceUrl, [
                        'source_file' => $sourceFile,
                    ]);
                }
                $result['imported']++;
            } catch (Throwable $exception) {
                report($exception);
                $result['failed']++;
            }
        }

        return $result;
    }

    /** @return array<string, int> */
    private function importTerraria(int $limit, bool $force, bool $dryRun): array
    {
        $result = ['examined' => 0, 'imported' => 0, 'skipped' => 0, 'missing' => 0, 'failed' => 0];
        $items = $this->catalogDatabase()->table('items as i')->join('mods as m', 'm.id', '=', 'i.mod_id')
            ->where('m.mod_key', 'vanilla')->orderBy('i.id')->get(['i.global_id', 'i.display_name']);
        $pending = [];
        foreach ($items as $item) {
            if ($limit > 0 && $result['examined'] >= $limit) {
                break;
            }
            $result['examined']++;
            $row = (array) $item;
            $globalId = (string) $row['global_id'];
            if (! $force && $this->assetExists($globalId)) {
                $result['skipped']++;

                continue;
            }
            $pending[] = ['global_id' => $globalId, 'title' => 'File:'.(string) $row['display_name'].'.png'];
        }

        foreach (array_chunk($pending, 50) as $batch) {
            $titles = implode('|', array_column($batch, 'title'));
            try {
                $response = Http::withUserAgent('rechi-os-game-data/1.0')->timeout(30)->retry(2, 500)
                    ->get((string) config('game-data.icons.terraria_wiki_api'), [
                        'action' => 'query', 'format' => 'json', 'prop' => 'imageinfo', 'iiprop' => 'url',
                        'redirects' => 1, 'titles' => $titles,
                    ]);
                $urls = $this->wikiUrls($response, $batch);
                $downloads = Http::pool(function (Pool $pool) use ($urls): array {
                    $requests = [];
                    foreach ($urls as $globalId => $url) {
                        $requests[] = $pool->as($globalId)->withHeaders(['User-Agent' => 'rechi-os-game-data/1.0'])
                            ->timeout(30)->get($url);
                    }

                    return $requests;
                });
                foreach ($batch as $entry) {
                    $globalId = $entry['global_id'];
                    $url = $urls[$globalId] ?? null;
                    $download = $downloads[$globalId] ?? null;
                    if (! is_string($url) || ! $download instanceof Response || ! $download->successful()) {
                        $result['missing']++;

                        continue;
                    }
                    if (! $dryRun) {
                        $this->store($globalId, $download->body(), 'terraria_wiki', $url, [
                            'file_title' => $entry['title'],
                        ]);
                    }
                    $result['imported']++;
                }
            } catch (Throwable $exception) {
                report($exception);
                $result['failed'] += count($batch);
            }
        }

        return $result;
    }

    /**
     * @param  list<array{global_id: string, title: string}>  $batch
     * @return array<string, string>
     */
    private function wikiUrls(Response $response, array $batch): array
    {
        if (! $response->successful()) {
            return [];
        }
        $titleToGlobalId = [];
        foreach ($batch as $entry) {
            $titleToGlobalId[strtolower(str_replace(' ', '_', $entry['title']))] = $entry['global_id'];
        }
        $urls = [];
        $pages = $response->json('query.pages', []);
        if (! is_array($pages)) {
            return [];
        }
        foreach ($pages as $page) {
            if (! is_array($page)) {
                continue;
            }
            $title = strtolower(str_replace(' ', '_', (string) ($page['title'] ?? '')));
            $globalId = $titleToGlobalId[$title] ?? null;
            $url = $page['imageinfo'][0]['url'] ?? null;
            if (is_string($globalId) && is_string($url)) {
                $urls[$globalId] = $url;
            }
        }

        return $urls;
    }

    /** @param array<string, scalar|null> $metadata */
    private function store(string $globalId, string $bytes, string $sourceType, ?string $sourceUrl, array $metadata): void
    {
        $image = getimagesizefromstring($bytes);
        if ($image === false || $image['mime'] !== 'image/png') {
            throw new RuntimeException("Invalid PNG asset for {$globalId}.");
        }
        $disk = (string) config('game-data.icons.disk', 'public');
        $prefix = trim((string) config('game-data.icons.prefix', 'game-data/items'), '/');
        [$namespace, $key] = array_pad(explode(':', $globalId, 2), 2, 'unknown');
        $path = $prefix.'/'.preg_replace('/[^a-z0-9_-]+/i', '-', $namespace).'/'.preg_replace('/[^a-z0-9_-]+/i', '-', $key).'.png';
        if (! Storage::disk($disk)->put($path, $bytes)) {
            throw new RuntimeException("Unable to write asset for {$globalId}.");
        }

        $now = now();
        DB::table('game_item_assets')->updateOrInsert([
            'item_global_id' => $globalId, 'asset_type' => 'icon', 'variant' => 'default',
        ], [
            'disk' => $disk, 'path' => $path, 'mime_type' => (string) $image['mime'],
            'width' => (int) $image[0], 'height' => (int) $image[1], 'byte_size' => strlen($bytes),
            'sha256' => hash('sha256', $bytes), 'source_type' => $sourceType, 'source_url' => $sourceUrl,
            'source_revision' => $sourceType === 'calamity_repository'
                ? (string) config('game-data.icons.calamity_source_revision') : null,
            'status' => 'ready', 'error_message' => null,
            'metadata_json' => json_encode($metadata, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    /** @return array<string, string> */
    private function pngIndex(string $repository): array
    {
        if (! is_dir($repository)) {
            throw new RuntimeException("Calamity repository not found: {$repository}");
        }
        $index = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($repository));
        foreach ($iterator as $file) {
            if ($file instanceof SplFileInfo && $file->isFile() && strtolower($file->getExtension()) === 'png') {
                $index[strtolower($file->getFilename())] ??= $file->getPathname();
            }
        }

        return $index;
    }

    private function assetExists(string $globalId): bool
    {
        $asset = DB::table('game_item_assets')->where('item_global_id', $globalId)
            ->where('asset_type', 'icon')->where('variant', 'default')->where('status', 'ready')->first();
        if (! $asset) {
            return false;
        }
        $row = (array) $asset;

        return Storage::disk((string) $row['disk'])->exists((string) $row['path']);
    }

    /**
     * @param  array<string, int>  $left
     * @param  array<string, int>  $right
     * @return array<string, int>
     */
    private function merge(array $left, array $right): array
    {
        foreach ($right as $key => $value) {
            $left[$key] = ($left[$key] ?? 0) + $value;
        }

        return $left;
    }

    private function nullableConfig(string $key): ?string
    {
        $value = trim((string) config($key, ''));

        return $value === '' ? null : $value;
    }

    private function catalogDatabase(): ConnectionInterface
    {
        return DB::connection((string) config('game-data.connection', config('database.default')));
    }
}
