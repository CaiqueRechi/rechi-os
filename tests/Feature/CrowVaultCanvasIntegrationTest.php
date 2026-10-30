<?php

namespace Tests\Feature;

use App\Enums\ScreenAccessLevel;
use App\Models\ScreenAccessPermission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CrowVaultCanvasIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_rf_14_redirects_guests_without_exposing_the_vault(): void
    {
        $this->get('/vault')
            ->assertRedirect(route('login'));
    }

    public function test_rf_14_rejects_authenticated_users_without_vault_permission(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/vault')
            ->assertForbidden();
    }

    public function test_rf_14_opens_the_package_page_for_an_authorized_user(): void
    {
        $user = User::factory()->create();

        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Read,
        ]);

        $this->actingAs($user)
            ->get('/vault')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('cvc/vault', shouldExist: false));
    }
}
