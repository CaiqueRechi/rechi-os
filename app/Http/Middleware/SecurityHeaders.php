<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set(
            'Content-Security-Policy',
            $this->contentSecurityPolicy(),
        );

        if (app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    private function contentSecurityPolicy(): string
    {
        $viteHttpSource = app()->isLocal() ? ' http://127.0.0.1:5173' : '';
        $viteWebSocketSource = app()->isLocal() ? ' ws://127.0.0.1:5173' : '';

        return "default-src 'self'; script-src 'self' 'unsafe-inline'{$viteHttpSource}; style-src 'self' 'unsafe-inline'{$viteHttpSource}; img-src 'self' data:{$viteHttpSource}; connect-src 'self'{$viteHttpSource}{$viteWebSocketSource}; font-src 'self' data:{$viteHttpSource}; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
    }
}
