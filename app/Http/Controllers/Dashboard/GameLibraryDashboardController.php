<?php

namespace App\Http\Controllers\Dashboard;

use App\Enums\ScreenAccessLevel;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GameLibraryDashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $games = [];

        if ($user?->is_admin) {
            $games[] = [
                'name' => 'Terraria',
                'description' => 'Consulte itens e explore builds de progressão para todas as classes e subclasses.',
                'href' => '/dashboard/biblioteca/terraria',
                'logo' => '/images/games/terraria-logo.png',
                'details' => 'Vanilla + Calamity Mod',
                'theme' => 'terraria',
            ];
        }

        if ($user?->hasScreenAccess('salem', ScreenAccessLevel::Read)) {
            $games[] = [
                'name' => 'Salém',
                'description' => 'Entre nas ilhas flutuantes, acompanhe sua progressão e negocie itens.',
                'href' => '/salem',
                'logo' => null,
                'details' => 'Progressão + Mercado',
                'theme' => 'salem',
            ];
        }

        return Inertia::render('game-library/index', ['games' => $games]);
    }
}
