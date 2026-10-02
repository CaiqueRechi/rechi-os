<?php

namespace App\Http\Middleware;

use App\Enums\ScreenAccessLevel;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureScreenAccess
{
    public function handle(Request $request, Closure $next, string $screenKey, string $required = 'read'): Response
    {
        $requiredLevel = ScreenAccessLevel::tryFrom($required);

        abort_if($requiredLevel === null, Response::HTTP_INTERNAL_SERVER_ERROR, 'Invalid screen access level.');
        abort_unless(
            $request->user()?->hasScreenAccess($screenKey, $requiredLevel),
            Response::HTTP_FORBIDDEN,
        );

        return $next($request);
    }
}
