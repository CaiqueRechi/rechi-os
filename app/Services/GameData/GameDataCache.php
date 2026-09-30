<?php

namespace App\Services\GameData;

use Closure;
use Illuminate\Support\Facades\Cache;

class GameDataCache
{
    private const REVISION_KEY = 'game-data:revision';

    /**
     * @template T
     *
     * @param  Closure(): T  $resolver
     * @return T
     */
    public function remember(string $key, Closure $resolver): mixed
    {
        $ttl = max(0, (int) config('game-data.cache_ttl', 900));
        if ($ttl === 0 || app()->environment('testing')) {
            return $resolver();
        }

        $revision = (string) Cache::get(self::REVISION_KEY, '1');

        return Cache::remember("game-data:{$revision}:{$key}", $ttl, $resolver);
    }

    public function bump(): void
    {
        Cache::forever(self::REVISION_KEY, now()->format('Uv').'-'.random_int(1000, 9999));
    }
}
