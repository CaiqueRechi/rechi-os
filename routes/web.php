<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\AssistantController;
use App\Http\Controllers\ContactController;
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
});

require __DIR__.'/settings.php';
