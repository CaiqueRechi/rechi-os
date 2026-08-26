<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Services\PublicPortfolioRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class SkillController extends Controller
{
    public function __invoke(PublicPortfolioRepository $portfolio): JsonResponse
    {
        $data = $portfolio->skills()->map(fn (SkillCategory $category) => [
            'name' => $category->name,
            'slug' => $category->slug,
            'skills' => $category->skills->map(fn (Skill $skill) => [
                'name' => $skill->name,
                'slug' => $skill->slug,
                'summary' => $skill->summary,
            ])->values()->all(),
        ])->values();

        return ApiResponse::ok($data);
    }
}
