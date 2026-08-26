<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Services\PublicPortfolioRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ProjectController extends Controller
{
    public function index(PublicPortfolioRepository $portfolio): JsonResponse
    {
        return ApiResponse::ok(ProjectResource::collection($portfolio->projects()));
    }

    public function show(PublicPortfolioRepository $portfolio, string $slug): JsonResponse
    {
        $project = $portfolio->project($slug);

        abort_if($project === null, 404);

        return ApiResponse::ok(ProjectResource::make($project));
    }
}
