<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProfileResource;
use App\Services\PublicPortfolioRepository;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class ProfileController extends Controller
{
    public function __invoke(PublicPortfolioRepository $portfolio): JsonResponse
    {
        $profile = $portfolio->profile();

        abort_if($profile === null, 404);

        return ApiResponse::ok(ProfileResource::make($profile));
    }
}
