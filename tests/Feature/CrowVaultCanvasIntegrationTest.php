<?php

namespace Tests\Feature;

use App\Enums\ScreenAccessLevel;
use App\Models\ScreenAccessPermission;
use App\Models\User;
use CrowVaultCanvas\Domain\Knowledge\Models\KnowledgeContext;
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

        $this->artisan('cvc:initialize')->assertSuccessful();

        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Read,
        ]);

        $this->actingAs($user)
            ->get('/vault')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cvc/vault', shouldExist: false)
                ->where('vault.id', config('crow-vault-canvas.vault.id'))
                ->where('vault.name', 'Crow Vault Canvas')
                ->has('vault.universes', 1)
                ->where('vault.universes.0.name', 'Meu Universo')
                ->has('vault.universes.0.contexts', 1)
                ->where('vault.universes.0.contexts.0.name', 'Primeiro Contexto'));
    }

    public function test_rf_14_rejects_document_writes_without_write_permission(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $context = KnowledgeContext::query()->where('kind', KnowledgeContext::KIND_CONTEXT)->firstOrFail();

        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Read,
        ]);

        $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $context->getKey()])
            ->assertForbidden();
    }

    public function test_rf_03_persists_markdown_through_the_rechi_os_boundary(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $context = KnowledgeContext::query()->where('kind', KnowledgeContext::KIND_CONTEXT)->firstOrFail();

        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Write,
        ]);

        $entityId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $context->getKey()])
            ->assertCreated()
            ->json('document.id');
        $markdown = "# Nota integrada\n\nConteúdo exato.\n";

        $this->actingAs($user)
            ->patchJson("/vault/documents/{$entityId}", [
                'content' => $markdown,
                'revision' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('document.content', $markdown)
            ->assertJsonPath('document.revision', 2);
        $this->actingAs($user)
            ->getJson("/vault/documents/{$entityId}")
            ->assertOk()
            ->assertJsonPath('document.content', $markdown);
    }
}
