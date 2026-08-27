<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SkillResource;
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
            'skills' => SkillResource::collection($category->skills)->resolve(),
        ])->values();

        return ApiResponse::ok($data);
    }
}
