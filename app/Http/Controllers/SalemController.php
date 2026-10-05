<?php

namespace App\Http\Controllers;

use App\Enums\ScreenAccessLevel;
use App\Services\Salem\SalemMarketService;
use App\Services\Salem\SalemPlayerIdentityService;
use App\Services\Salem\SalemProgressionService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SalemController extends Controller
{
    public function __invoke(
        Request $request,
        SalemPlayerIdentityService $identity,
        SalemProgressionService $progression,
        SalemMarketService $market,
    ): Response {
        $player = $identity->resolvePlayer($request);
        $save = $progression->resolveSave($player);

        return Inertia::render('salem/index', [
            'initialSave' => $progression->serializeSave($save),
            'market' => $market->catalogFor($player),
            'access' => [
                'level' => $request->user()?->screenAccessLevel('salem')->value,
                'canWrite' => $request->user()?->hasScreenAccess('salem', ScreenAccessLevel::Write) ?? false,
            ],
        ]);
    }
}
