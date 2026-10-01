<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\AssistantController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\Dashboard\GameDataController;
use App\Http\Controllers\Dashboard\GameLibraryDashboardController;
use App\Http\Controllers\Dashboard\GamePlannerDashboardController;
use App\Http\Controllers\PortfolioController;
use App\Http\Controllers\SalemActionController;
use App\Http\Controllers\SalemController;
use Illuminate\Support\Facades\Route;

Route::get('/', PortfolioController::class)->name('home');
Route::post('/contact', [ContactController::class, 'store'])->middleware('throttle:contact')->name('contact.store');
Route::post('/ask-rechi', AssistantController::class)->middleware('throttle:assistant')->name('assistant.ask');
Route::get('/salem', SalemController::class)->name('salem.index');
Route::post('/salem/actions', SalemActionController::class)->middleware('throttle:salem-actions')->name('salem.actions.store');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('admin', AdminController::class)->middleware('can:managePortfolio')->name('admin.dashboard');
    Route::get('dashboard/biblioteca', GameLibraryDashboardController::class)
        ->middleware('can:managePortfolio')->name('dashboard.library');
    Route::get('dashboard/biblioteca/terraria', GamePlannerDashboardController::class)
        ->middleware('can:managePortfolio')->name('dashboard.library.terraria');
    Route::redirect('dashboard/game-planner', '/dashboard/biblioteca/terraria')
        ->middleware('can:managePortfolio')->name('dashboard.game-planner');

    Route::prefix('dashboard/game-data')
        ->middleware('can:managePortfolio')
        ->name('dashboard.game-data.')
        ->controller(GameDataController::class)
        ->group(function (): void {
            Route::get('/', 'overview')->name('overview');
            Route::get('/items', 'items')->name('items.index');
            Route::get('/items/{globalId}', 'item')->name('items.show');
            Route::get('/recipes', 'recipes')->name('recipes.index');
            Route::get('/npcs', 'npcs')->name('npcs.index');
            Route::get('/npcs/{globalId}', 'npc')->name('npcs.show');
            Route::get('/classes', 'archetypes')->name('classes.index');
            Route::get('/classes/{archetypeKey}/items', 'archetypeItems')->name('classes.items');
            Route::get('/progression', 'progression')->name('progression.index');
            Route::get('/planners', 'planners')->name('planners.index');
            Route::get('/planners/{plannerKey}', 'planner')->name('planners.show');
        });
});

require __DIR__.'/settings.php';
