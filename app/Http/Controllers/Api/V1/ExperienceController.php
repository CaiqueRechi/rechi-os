<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExperienceResource;
use App\Services\PublicPortfolioRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ExperienceController extends Controller
{
    public function __invoke(PublicPortfolioRepository $portfolio): JsonResponse
    {
        return ApiResponse::ok(ExperienceResource::collection($portfolio->experiences()));
    }
}
