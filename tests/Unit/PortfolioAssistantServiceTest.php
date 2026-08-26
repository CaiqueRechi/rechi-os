<?php

namespace Tests\Unit;

use App\Services\Ai\AiGateway;
use App\Services\Ai\PortfolioAssistantService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class PortfolioAssistantServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_falls_back_without_leaking_errors_when_the_gateway_fails(): void
    {
        $this->seed();

        $this->app->bind(AiGateway::class, fn () => new class implements AiGateway
        {
            public function respond(array $messages, array $tools): string
            {
                throw new RuntimeException('network down');
            }
        });

        $service = $this->app->make(PortfolioAssistantService::class);

        $this->assertStringContainsString(
            'Caique Rechi',
            $service->answer('What does Caique build?', 'test-session', '127.0.0.1'),
        );
    }
}
