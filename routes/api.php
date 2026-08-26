<?php

use App\Http\Controllers\Api\V1\ExperienceController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\ProjectController;
use App\Http\Controllers\Api\V1\SkillController;
use App\Http\Controllers\Api\V1\SocialLinkController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('throttle:api-public')->group(function () {
    Route::get('profile', ProfileController::class);
    Route::get('projects', [ProjectController::class, 'index']);
    Route::get('projects/{slug}', [ProjectController::class, 'show']);
    Route::get('experiences', ExperienceController::class);
    Route::get('skills', SkillController::class);
    Route::get('social-links', SocialLinkController::class);
});
