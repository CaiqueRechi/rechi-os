<?php

namespace App\Services;

use Closure;
use Illuminate\Support\Facades\Cache;
use Traversable;

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
        $value = Cache::get($key);

        if ($this->containsIncompleteClass($value)) {
            Cache::forget($key);
        }

        return Cache::remember($key, now()->addMinutes(15), $resolver);
    }

    private function containsIncompleteClass(mixed $value): bool
    {
        if ($value instanceof \__PHP_Incomplete_Class) {
            return true;
        }

        if (is_array($value) || $value instanceof Traversable) {
            foreach ($value as $item) {
                if ($this->containsIncompleteClass($item)) {
                    return true;
                }
            }
        }

        return false;
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
