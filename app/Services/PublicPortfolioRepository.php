<?php

namespace App\Services;

use App\Models\Experience;
use App\Models\Profile;
use App\Models\Project;
use App\Models\SkillCategory;
use App\Models\SocialLink;
use Illuminate\Database\Eloquent\Collection;

class PublicPortfolioRepository
{
    public function __construct(private readonly PortfolioCacheService $cache) {}

    public function profile(): ?Profile
    {
        return $this->cache->remember(
            PortfolioCacheService::PROFILE,
            fn () => Profile::query()->latest('updated_at')->first(),
        );
    }

    /**
     * @return Collection<int, Project>
     */
    public function projects(): Collection
    {
        return $this->cache->remember(
            PortfolioCacheService::PROJECTS,
            fn () => Project::query()
                ->with(['images', 'skills'])
                ->where('status', 'published')
                ->orderBy('sort_order')
                ->get(),
        );
    }

    public function project(string $slug): ?Project
    {
        return $this->cache->remember(
            "portfolio:project:{$slug}",
            fn () => Project::query()
                ->with(['images', 'skills'])
                ->where('status', 'published')
                ->where('slug', $slug)
                ->first(),
        );
    }

    /**
     * @return Collection<int, Experience>
     */
    public function experiences(): Collection
    {
        return $this->cache->remember(
            PortfolioCacheService::EXPERIENCES,
            fn () => Experience::query()->with('skills')->orderBy('sort_order')->get(),
        );
    }

    /**
     * @return Collection<int, SkillCategory>
     */
    public function skills(): Collection
    {
        return $this->cache->remember(
            PortfolioCacheService::SKILLS,
            fn () => SkillCategory::query()->with('skills')->orderBy('sort_order')->get(),
        );
    }

    /**
     * @return Collection<int, SocialLink>
     */
    public function socialLinks(): Collection
    {
        return $this->cache->remember(
            PortfolioCacheService::SOCIAL_LINKS,
            fn () => SocialLink::query()->where('public', true)->orderBy('sort_order')->get(),
        );
    }
}
