<?php

namespace Tests\Unit;

use App\Services\TerminalCommandService;
use PHPUnit\Framework\TestCase;

class TerminalCommandServiceTest extends TestCase
{
    public function test_runs_whitelisted_commands_only(): void
    {
        $service = new TerminalCommandService;

        $this->assertSame(['IMS', 'BudgetCore', 'Payment Flow'], $service->run('projects'));
        $this->assertSame(['Command not allowed. Type help.'], $service->run('cat .env'));
    }
}
