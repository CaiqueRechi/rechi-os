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

    public function test_only_admin_can_open_the_game_planner_page(): void
    {
        $this->get('/dashboard/game-planner')->assertRedirect(route('login'));

        $user = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($user)->get('/dashboard/game-planner')->assertForbidden();

        $admin = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);
        $this->actingAs($admin)->get('/dashboard/game-planner')
            ->assertOk()->assertInertia(fn ($page) => $page->component('game-data/index'));
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

    public function test_admin_can_query_versioned_class_definitions_before_the_catalog_is_installed(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'email_verified_at' => now()]);

        $this->artisan('game-data:import-planners')->assertSuccessful();

        $this->actingAs($admin)->getJson('/dashboard/game-data/classes')
            ->assertOk()
            ->assertJsonCount(25, 'data')
            ->assertJsonPath('data.0.archetype_key', 'melee');
        $this->actingAs($admin)->getJson('/dashboard/game-data/progression')
            ->assertOk()
            ->assertJsonPath('data.0.track_key', 'terraria-calamity-auto-v1')
            ->assertJsonCount(0, 'data.0.milestones');
        $this->actingAs($admin)->getJson('/dashboard/game-data/classes/melee/items')
            ->assertStatus(503)
            ->assertJsonPath('code', 'game_dataset_unavailable');
    }
}
