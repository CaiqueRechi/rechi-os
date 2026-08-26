<?php

namespace App\Observers;

use App\Models\Experience;
use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\SocialLink;
use App\Services\PortfolioCacheService;

class PortfolioCacheObserver
{
    public function saved(object $model): void
    {
        $this->forget($model);
    }

    public function deleted(object $model): void
    {
        $this->forget($model);
    }

    private function forget(object $model): void
    {
        $cache = app(PortfolioCacheService::class);

        match (true) {
            $model instanceof Profile => $cache->forgetPublicPortfolio(),
            $model instanceof Experience => $cache->forgetPublicPortfolio(),
            $model instanceof Skill || $model instanceof SkillCategory => $cache->forgetPublicPortfolio(),
            $model instanceof SocialLink => $cache->forgetPublicPortfolio(),
            $model instanceof Project => $cache->forgetProject($model->slug),
            default => null,
        };
    }
}
