<?php

namespace App\Services;

use Closure;
use Illuminate\Support\Facades\Cache;

class PortfolioCacheService
{
    public const PROFILE = 'portfolio:profile';

    public const PROJECTS = 'portfolio:projects';

    public const EXPERIENCES = 'portfolio:experiences';

    public const SKILLS = 'portfolio:skills';

    public const SOCIAL_LINKS = 'portfolio:social-links';

    /**
     * @template T
     *
     * @param  Closure(): T  $resolver
     * @return T
     */
    public function remember(string $key, Closure $resolver): mixed
    {
        return Cache::remember($key, now()->addMinutes(15), $resolver);
    }

    public function forgetPublicPortfolio(): void
    {
        Cache::forget(self::PROFILE);
        Cache::forget(self::PROJECTS);
        Cache::forget(self::EXPERIENCES);
        Cache::forget(self::SKILLS);
        Cache::forget(self::SOCIAL_LINKS);
    }

    public function forgetProject(string $slug): void
    {
        Cache::forget(self::PROJECTS);
        Cache::forget("portfolio:project:{$slug}");
    }
}
