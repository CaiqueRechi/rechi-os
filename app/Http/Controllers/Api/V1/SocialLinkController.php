<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialLinkResource;
use App\Services\PublicPortfolioRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class SocialLinkController extends Controller
{
    public function __invoke(PublicPortfolioRepository $portfolio): JsonResponse
    {
        return ApiResponse::ok(SocialLinkResource::collection($portfolio->socialLinks()));
    }
}
