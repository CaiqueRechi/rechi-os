<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateAdminUserCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_created_admin_can_access_verified_dashboard_routes(): void
    {
        $this->artisan('portfolio:create-admin', [
            'email' => 'admin@example.com',
            '--name' => 'Admin User',
        ])->expectsQuestion('Admin password', 'a-strong-password-for-tests')
            ->expectsOutput('Admin user created.')
            ->assertSuccessful();

        $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();

        $this->assertTrue($admin->is_admin);
        $this->assertNotNull($admin->email_verified_at);
    }
}
