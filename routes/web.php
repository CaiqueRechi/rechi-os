<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\PortfolioContentController;
use App\Http\Controllers\AssistantController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\PortfolioController;
use Illuminate\Support\Facades\Route;

Route::get('/', PortfolioController::class)->name('home');
Route::post('/contact', [ContactController::class, 'store'])->middleware('throttle:contact')->name('contact.store');
Route::post('/ask-rechi', AssistantController::class)->middleware('throttle:assistant')->name('assistant.ask');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::middleware('can:managePortfolio')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/', AdminController::class)->name('dashboard');
        Route::patch('profile', [PortfolioContentController::class, 'updateProfile'])->name('profile.update');
        Route::post('skill-categories', [PortfolioContentController::class, 'storeSkillCategory'])->name('skill-categories.store');
        Route::patch('skill-categories/{category}', [PortfolioContentController::class, 'updateSkillCategory'])->name('skill-categories.update');
        Route::delete('skill-categories/{category}', [PortfolioContentController::class, 'destroySkillCategory'])->name('skill-categories.destroy');
        Route::post('skills', [PortfolioContentController::class, 'storeSkill'])->name('skills.store');
        Route::patch('skills/{skill}', [PortfolioContentController::class, 'updateSkill'])->name('skills.update');
        Route::delete('skills/{skill}', [PortfolioContentController::class, 'destroySkill'])->name('skills.destroy');
        Route::post('experiences', [PortfolioContentController::class, 'storeExperience'])->name('experiences.store');
        Route::patch('experiences/{experience}', [PortfolioContentController::class, 'updateExperience'])->name('experiences.update');
        Route::delete('experiences/{experience}', [PortfolioContentController::class, 'destroyExperience'])->name('experiences.destroy');
        Route::post('projects', [PortfolioContentController::class, 'storeProject'])->name('projects.store');
        Route::patch('projects/{project}', [PortfolioContentController::class, 'updateProject'])->name('projects.update');
        Route::delete('projects/{project}', [PortfolioContentController::class, 'destroyProject'])->name('projects.destroy');
        Route::post('social-links', [PortfolioContentController::class, 'storeSocialLink'])->name('social-links.store');
        Route::patch('social-links/{socialLink}', [PortfolioContentController::class, 'updateSocialLink'])->name('social-links.update');
        Route::delete('social-links/{socialLink}', [PortfolioContentController::class, 'destroySocialLink'])->name('social-links.destroy');
    });
});

require __DIR__.'/settings.php';
