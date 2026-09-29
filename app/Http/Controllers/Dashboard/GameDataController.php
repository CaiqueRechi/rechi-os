<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\GameData\GameCatalogService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameDataController extends Controller
{
    public function overview(GameCatalogService $catalog): JsonResponse
    {
        return $catalog->isReady()
            ? response()->json(['data' => $catalog->overview()])
            : $this->unavailable();
    }

    public function items(Request $request, GameCatalogService $catalog): JsonResponse
    {
        if (! $catalog->isReady()) {
            return $this->unavailable();
        }

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'], 'game' => ['nullable', 'string', 'max:64'],
            'mod' => ['nullable', 'string', 'max:128'], 'category' => ['nullable', 'string', 'max:128'],
            'combat_class' => ['nullable', 'string', 'max:128'], 'rarity' => ['nullable', 'string', 'max:255'],
            'progression' => ['nullable', 'string', 'max:255'], 'sort' => ['nullable', 'in:name,global_id,rarity'],
            'direction' => ['nullable', 'in:asc,desc'], 'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return $this->paginated($catalog->items($filters));
    }

    public function item(string $globalId, GameCatalogService $catalog): JsonResponse
    {
        if (! $catalog->isReady()) {
            return $this->unavailable();
        }

        $item = $catalog->item($globalId);

        return $item ? response()->json(['data' => $item]) : response()->json(['message' => 'Item not found.'], 404);
    }

    public function recipes(Request $request, GameCatalogService $catalog): JsonResponse
    {
        if (! $catalog->isReady()) {
            return $this->unavailable();
        }

        $filters = $request->validate([
            'item' => ['nullable', 'string', 'max:255'], 'mod' => ['nullable', 'string', 'max:128'],
            'historical' => ['nullable', 'boolean'], 'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return $this->paginated($catalog->recipes($filters));
    }

    public function npcs(Request $request, GameCatalogService $catalog): JsonResponse
    {
        if (! $catalog->isReady()) {
            return $this->unavailable();
        }

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'], 'game' => ['nullable', 'string', 'max:64'],
            'mod' => ['nullable', 'string', 'max:128'], 'boss' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return $this->paginated($catalog->npcs($filters));
    }

    public function npc(string $globalId, GameCatalogService $catalog): JsonResponse
    {
        if (! $catalog->isReady()) {
            return $this->unavailable();
        }

        $npc = $catalog->npc($globalId);

        return $npc ? response()->json(['data' => $npc]) : response()->json(['message' => 'NPC not found.'], 404);
    }

    private function unavailable(): JsonResponse
    {
        return response()->json(['message' => 'The game dataset is not installed.', 'code' => 'game_dataset_unavailable'], 503);
    }

    /** @param LengthAwarePaginator<int, object> $paginator */
    private function paginated(LengthAwarePaginator $paginator): JsonResponse
    {
        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(), 'from' => $paginator->firstItem(),
                'last_page' => $paginator->lastPage(), 'per_page' => $paginator->perPage(),
                'to' => $paginator->lastItem(), 'total' => $paginator->total(),
            ],
        ]);
    }
}
