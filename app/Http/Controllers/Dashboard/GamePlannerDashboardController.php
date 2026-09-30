<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class GamePlannerDashboardController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('game-data/index');
    }
}
