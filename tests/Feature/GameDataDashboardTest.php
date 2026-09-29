<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameDataDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_game_data(): void
    {
        $this->get('/dashboard/game-data')->assertRedirect(route('login'));
    }

    public function test_non_admin_cannot_access_game_data(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/dashboard/game-data')->assertForbidden();
    }

    public function test_admin_gets_a_clear_response_when_dataset_is_not_installed(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);

        $this->actingAs($admin)->getJson('/dashboard/game-data')
            ->assertStatus(503)->assertJsonPath('code', 'game_dataset_unavailable');
    }
}
