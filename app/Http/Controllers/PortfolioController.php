<?php

namespace App\Http\Controllers;

use App\Http\Resources\ExperienceResource;
use App\Http\Resources\ProfileResource;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\SocialLinkResource;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Services\PublicPortfolioRepository;
use Inertia\Inertia;
use Inertia\Response;

class PortfolioController extends Controller
{
    public function __invoke(PublicPortfolioRepository $portfolio): Response
    {
        $profile = $portfolio->profile();

        return Inertia::render('welcome', [
            'profile' => $profile ? ProfileResource::make($profile)->resolve() : null,
            'projects' => ProjectResource::collection($portfolio->projects())->resolve(),
            'experiences' => ExperienceResource::collection($portfolio->experiences())->resolve(),
            'skills' => $portfolio->skills()->map(fn (SkillCategory $category) => [
                'name' => $category->name,
                'slug' => $category->slug,
                'skills' => $category->skills->map(fn (Skill $skill) => [
                    'name' => $skill->name,
                    'slug' => $skill->slug,
                    'summary' => $skill->summary,
                ])->values()->all(),
            ])->values(),
            'socialLinks' => SocialLinkResource::collection($portfolio->socialLinks())->resolve(),
        ]);
    }
}
