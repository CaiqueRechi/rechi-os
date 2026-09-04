<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalemActionRequest;
use App\Services\Salem\SalemPlayerIdentityService;
use App\Services\Salem\SalemProgressionService;
use Illuminate\Http\JsonResponse;

class SalemActionController extends Controller
{
    public function __invoke(
        SalemActionRequest $request,
        SalemPlayerIdentityService $identity,
        SalemProgressionService $progression,
    ): JsonResponse {
        $player = $identity->resolvePlayer($request);

        return response()->json(
            $progression->recordAction($player, $request->string('action')->toString()),
        );
    }
}
