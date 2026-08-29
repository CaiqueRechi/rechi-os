<?php

namespace Tests\Feature;

use App\Http\Middleware\SecurityHeaders;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_local_csp_allows_the_vite_development_server(): void
    {
        app()->detectEnvironment(fn () => 'local');

        try {
            $response = (new SecurityHeaders)->handle(
                Request::create('/'),
                fn () => new Response,
            );

            $policy = $response->headers->get('Content-Security-Policy');

            $this->assertStringContainsString("script-src 'self' 'unsafe-inline' http://127.0.0.1:5173", $policy);
            $this->assertStringContainsString("connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173", $policy);
            $this->assertStringContainsString("font-src 'self' data: http://127.0.0.1:5173", $policy);
        } finally {
            app()->detectEnvironment(fn () => 'testing');
        }
    }

    public function test_production_csp_does_not_allow_the_vite_development_server(): void
    {
        app()->detectEnvironment(fn () => 'production');

        try {
            $response = (new SecurityHeaders)->handle(
                Request::create('/'),
                fn () => new Response,
            );

            $policy = $response->headers->get('Content-Security-Policy');

            $this->assertStringNotContainsString('127.0.0.1:5173', $policy);
            $this->assertSame(
                'max-age=31536000; includeSubDomains',
                $response->headers->get('Strict-Transport-Security'),
            );
        } finally {
            app()->detectEnvironment(fn () => 'testing');
        }
    }
}
