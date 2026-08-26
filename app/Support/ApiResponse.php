<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function ok(mixed $data, array $meta = [], int $status = 200): JsonResponse
    {
        $payload = [
            'data' => $data,
            'meta' => $meta,
        ];

        $response = response()->json($payload, $status);
        $response->setEtag(hash('xxh128', (string) json_encode($payload)));
        $response->headers->set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

        return $response;
    }
}
