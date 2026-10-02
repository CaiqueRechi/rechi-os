<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalemMarketRequest;
use App\Models\SalemShopItem;
use App\Services\Salem\SalemMarketService;
use App\Services\Salem\SalemPlayerIdentityService;
use Illuminate\Http\JsonResponse;

class SalemMarketController extends Controller
{
    public function __invoke(
        SalemMarketRequest $request,
        SalemPlayerIdentityService $identity,
        SalemMarketService $market,
    ): JsonResponse {
        $player = $identity->resolvePlayer($request);
        $item = SalemShopItem::query()->findOrFail($request->integer('item_id'));

        return response()->json($market->trade(
            $player,
            $item,
            $request->string('action')->toString(),
            $request->integer('quantity'),
        ));
    }
}
