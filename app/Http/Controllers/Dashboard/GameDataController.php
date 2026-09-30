<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\GameData\GameCatalogService;
use App\Services\GameData\GamePlannerService;
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

    public function archetypes(GamePlannerService $planners): JsonResponse
    {
        return $planners->isReady()
            ? response()->json(['data' => $planners->archetypes()])
            : $this->plannerUnavailable();
    }

    public function progression(GamePlannerService $planners): JsonResponse
    {
        return $planners->isReady()
            ? response()->json(['data' => $planners->tracks()])
            : $this->plannerUnavailable();
    }

    public function archetypeItems(
        string $archetypeKey,
        Request $request,
        GameCatalogService $catalog,
        GamePlannerService $planners,
    ): JsonResponse {
        if (! $catalog->isReady()) {
            return $this->unavailable();
        }

        if (! $planners->isReady()) {
            return $this->plannerUnavailable();
        }

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'mod' => ['nullable', 'string', 'max:128'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $items = $planners->candidates($archetypeKey, $filters);

        return $items ? $this->paginated($items) : response()->json(['message' => 'Class or subclass not found.'], 404);
    }

    public function planners(Request $request, GamePlannerService $planners): JsonResponse
    {
        if (! $planners->isReady()) {
            return $this->plannerUnavailable();
        }

        $filters = $request->validate([
            'status' => ['nullable', 'in:draft,published,archived'],
            'track' => ['nullable', 'string', 'max:128'],
            'archetype' => ['nullable', 'string', 'max:128'],
        ]);

        return response()->json(['data' => $planners->planners($filters)]);
    }

    public function planner(string $plannerKey, GamePlannerService $planners): JsonResponse
    {
        if (! $planners->isReady()) {
            return $this->plannerUnavailable();
        }

        $planner = $planners->planner($plannerKey);

        return $planner ? response()->json(['data' => $planner]) : response()->json(['message' => 'Planner not found.'], 404);
    }

    private function unavailable(): JsonResponse
    {
        return response()->json(['message' => 'The game dataset is not installed.', 'code' => 'game_dataset_unavailable'], 503);
    }

    private function plannerUnavailable(): JsonResponse
    {
        return response()->json(['message' => 'The game planner is not installed.', 'code' => 'game_planner_unavailable'], 503);
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
