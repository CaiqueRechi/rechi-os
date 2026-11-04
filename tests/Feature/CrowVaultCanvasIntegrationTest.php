<?php

namespace Tests\Feature;

use App\Enums\ScreenAccessLevel;
use App\Models\ScreenAccessPermission;
use App\Models\User;
use CrowVaultCanvas\Domain\Knowledge\Models\KnowledgeContext;
use CrowVaultCanvas\Domain\Knowledge\Models\Perspective;
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
                ->where('vault.universes.0.contexts.0.name', 'Primeiro Contexto')
                ->where('workspace.viewport.x', 120)
                ->where('workspace.viewport.y', 120)
                ->where('workspace.viewport.zoom', 0.65)
                ->where('workspace.focusEntityId', null));
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
        $this->actingAs($user)
            ->patchJson('/vault/entities/019a34a8-0c7e-71ec-88ca-c4fb55740102', [
                'type' => 'registro',
                'properties' => [],
            ])
            ->assertForbidden();
        $this->actingAs($user)
            ->postJson("/vault/contexts/{$context->getKey()}/entities", [
                'entity_id' => '019a34a8-0c7e-71ec-88ca-c4fb55740102',
            ])
            ->assertForbidden();
        $this->actingAs($user)
            ->postJson('/vault/relations', [
                'source_entity_id' => '019a34a8-0c7e-71ec-88ca-c4fb55740102',
                'target_entity_id' => '019a34a8-0c7e-71ec-88ca-c4fb55740103',
                'context_id' => null,
                'type' => null,
                'directed' => false,
                'properties' => [],
            ])
            ->assertForbidden();
        $this->actingAs($user)
            ->postJson('/vault/perspectives', [
                'name' => 'Sem permissão',
                'source_perspective_id' => null,
                'filters' => [
                    'context_ids' => [],
                    'entity_types' => [],
                ],
            ])
            ->assertForbidden();
        $this->actingAs($user)
            ->postJson('/vault/perspectives/019a34a8-0c7e-71ec-88ca-c4fb55740104/versions', [
                'name' => 'Sem permissão',
            ])
            ->assertForbidden();
        $this->actingAs($user)
            ->postJson('/vault/versions/019a34a8-0c7e-71ec-88ca-c4fb55740105/restore')
            ->assertForbidden();
    }

    public function test_rf_05_explorer_exposes_one_authorized_entity_in_multiple_contexts(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $universe = KnowledgeContext::query()
            ->where('kind', KnowledgeContext::KIND_UNIVERSE)
            ->firstOrFail();
        $firstContext = KnowledgeContext::query()
            ->where('kind', KnowledgeContext::KIND_CONTEXT)
            ->firstOrFail();
        $secondContext = KnowledgeContext::query()->create([
            'vault_id' => $universe->vault_id,
            'parent_id' => $universe->getKey(),
            'kind' => KnowledgeContext::KIND_CONTEXT,
            'name' => 'Contexto Compartilhado',
            'sort_order' => 1,
        ]);

        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Write,
        ]);

        $entityId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $firstContext->getKey()])
            ->assertCreated()
            ->json('document.id');
        $secondContext->entities()->attach($entityId);

        $this->actingAs($user)
            ->get('/vault')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('vault.universes.0.contexts', 2)
                ->where('vault.universes.0.contexts.0.documents.0.id', $entityId)
                ->where('vault.universes.0.contexts.1.documents.0.id', $entityId));
        $this->assertDatabaseCount('cvc_entities', 1);
        $this->assertDatabaseCount('cvc_context_entity', 2);
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

    public function test_rf_07_updates_properties_without_changing_identity_or_content(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $context = KnowledgeContext::query()
            ->where('kind', KnowledgeContext::KIND_CONTEXT)
            ->firstOrFail();

        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Write,
        ]);

        $entityId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $context->getKey()])
            ->assertCreated()
            ->json('document.id');
        $markdown = "# Identidade estável\n\nConteúdo canônico.\n";
        $this->actingAs($user)
            ->patchJson("/vault/documents/{$entityId}", [
                'content' => $markdown,
                'revision' => 1,
            ])
            ->assertOk();

        $this->actingAs($user)
            ->patchJson("/vault/entities/{$entityId}", [
                'type' => 'referência',
                'properties' => [
                    'status' => 'ativo',
                    'prioridade' => 2,
                ],
            ])
            ->assertOk()
            ->assertJsonPath('entity.id', $entityId)
            ->assertJsonPath('entity.entityType', 'referência')
            ->assertJsonPath('entity.properties.status', 'ativo')
            ->assertJsonPath('entity.properties.prioridade', 2);
        $this->actingAs($user)
            ->getJson("/vault/documents/{$entityId}")
            ->assertOk()
            ->assertJsonPath('document.id', $entityId)
            ->assertJsonPath('document.content', $markdown)
            ->assertJsonPath('document.revision', 2);
        $this->actingAs($user)
            ->patchJson("/vault/entities/{$entityId}", [
                'type' => 'inválido',
                'properties' => ['nested' => ['não permitido']],
            ])
            ->assertUnprocessable();
        $this->assertDatabaseCount('cvc_entities', 1);
        $this->assertDatabaseCount('cvc_documents', 1);
    }

    public function test_rf_08_manages_context_membership_layout_and_relations(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $firstContext = KnowledgeContext::query()
            ->where('kind', KnowledgeContext::KIND_CONTEXT)
            ->firstOrFail();
        $secondContext = KnowledgeContext::query()->create([
            'vault_id' => $firstContext->vault_id,
            'parent_id' => $firstContext->parent_id,
            'kind' => KnowledgeContext::KIND_CONTEXT,
            'name' => 'Segundo Contexto',
            'sort_order' => 1,
        ]);
        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Write,
        ]);

        $sourceId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $firstContext->getKey()])
            ->assertCreated()
            ->json('document.id');
        $targetId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $firstContext->getKey()])
            ->assertCreated()
            ->json('document.id');

        $this->actingAs($user)
            ->postJson("/vault/contexts/{$secondContext->getKey()}/entities", [
                'entity_id' => $sourceId,
            ])
            ->assertOk()
            ->assertJsonPath('attached', true);
        $this->actingAs($user)
            ->patchJson("/vault/contexts/{$firstContext->getKey()}/entities/{$sourceId}/layout", [
                'position' => ['x' => 180.5, 'y' => 90.25],
                'pinned' => true,
            ])
            ->assertOk();
        $relationId = $this->actingAs($user)
            ->postJson('/vault/relations', [
                'source_entity_id' => $sourceId,
                'target_entity_id' => $targetId,
                'context_id' => $firstContext->getKey(),
                'type' => 'depends_on',
                'directed' => true,
                'properties' => [],
            ])
            ->assertCreated()
            ->assertJsonPath('relation.sourceEntityId', $sourceId)
            ->assertJsonPath('relation.targetEntityId', $targetId)
            ->json('relation.id');

        $this->actingAs($user)
            ->postJson('/vault/relations', [
                'source_entity_id' => $sourceId,
                'target_entity_id' => $targetId,
                'context_id' => $firstContext->getKey(),
                'type' => 'depends_on',
                'directed' => true,
                'properties' => [],
            ])
            ->assertUnprocessable();
        $this->actingAs($user)
            ->deleteJson("/vault/relations/{$relationId}")
            ->assertNoContent();

        $this->assertDatabaseHas('cvc_context_entity', [
            'context_id' => $secondContext->getKey(),
            'entity_id' => $sourceId,
        ]);
        $this->assertDatabaseHas('cvc_context_entity', [
            'context_id' => $firstContext->getKey(),
            'entity_id' => $sourceId,
            'position_x' => 180.5,
            'position_y' => 90.25,
            'is_pinned' => true,
        ]);
        $this->assertSoftDeleted('cvc_relations', ['id' => $relationId]);
    }

    public function test_rf_09_keeps_a_derived_perspective_independent(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $context = KnowledgeContext::query()
            ->where('kind', KnowledgeContext::KIND_CONTEXT)
            ->firstOrFail();
        $source = Perspective::query()->firstOrFail();
        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Write,
        ]);
        $entityId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $context->getKey()])
            ->assertCreated()
            ->json('document.id');

        $this->actingAs($user)
            ->patchJson("/vault/perspectives/{$source->getKey()}", [
                'name' => 'Origem',
                'filters' => [
                    'context_ids' => [$context->getKey()],
                    'entity_types' => [],
                ],
            ])
            ->assertOk();
        $this->actingAs($user)
            ->patchJson("/vault/perspectives/{$source->getKey()}/contexts/{$context->getKey()}/entities/{$entityId}/layout", [
                'position' => ['x' => 90.5, 'y' => 140.25],
                'pinned' => true,
            ])
            ->assertOk();
        $derivedId = $this->actingAs($user)
            ->postJson('/vault/perspectives', [
                'name' => 'Derivada',
                'source_perspective_id' => $source->getKey(),
                'filters' => [
                    'context_ids' => [],
                    'entity_types' => [],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('perspective.layouts.0.isPinned', true)
            ->json('perspective.id');
        $this->actingAs($user)
            ->patchJson("/vault/perspectives/{$derivedId}", [
                'name' => 'Derivada alterada',
                'filters' => [
                    'context_ids' => [],
                    'entity_types' => ['referência'],
                ],
            ])
            ->assertOk();

        $source->refresh();
        self::assertSame('Origem', $source->name);
        self::assertSame([$context->getKey()], $source->filters['context_ids']);
        $this->assertDatabaseHas('cvc_perspective_layouts', [
            'perspective_id' => $source->getKey(),
            'entity_id' => $entityId,
            'position_x' => 90.5,
            'is_pinned' => true,
        ]);
    }

    public function test_rf_10_restores_a_named_version_with_a_recovery_point(): void
    {
        $user = User::factory()->create();
        $this->artisan('cvc:initialize')->assertSuccessful();
        $context = KnowledgeContext::query()
            ->where('kind', KnowledgeContext::KIND_CONTEXT)
            ->firstOrFail();
        $perspective = Perspective::query()->firstOrFail();
        ScreenAccessPermission::query()->create([
            'user_id' => $user->id,
            'screen_key' => 'vault',
            'access_level' => ScreenAccessLevel::Write,
        ]);
        $entityId = $this->actingAs($user)
            ->postJson('/vault/documents', ['context_id' => $context->getKey()])
            ->assertCreated()
            ->json('document.id');
        $this->actingAs($user)
            ->patchJson("/vault/documents/{$entityId}", [
                'content' => '# marco inicial',
                'revision' => 1,
            ])
            ->assertOk();
        $versionId = $this->actingAs($user)
            ->postJson("/vault/perspectives/{$perspective->getKey()}/versions", [
                'name' => 'Marco inicial',
            ])
            ->assertCreated()
            ->assertJsonPath('version.kind', 'named')
            ->json('version.id');
        $this->actingAs($user)
            ->patchJson("/vault/documents/{$entityId}", [
                'content' => '# estado posterior',
                'revision' => 2,
            ])
            ->assertOk();

        $this->actingAs($user)
            ->postJson("/vault/versions/{$versionId}/restore")
            ->assertOk()
            ->assertJsonPath('restoredVersion.id', $versionId)
            ->assertJsonPath('recoveryVersion.kind', 'recovery');
        $this->actingAs($user)
            ->getJson("/vault/documents/{$entityId}")
            ->assertOk()
            ->assertJsonPath('document.content', '# marco inicial')
            ->assertJsonPath('document.revision', 2);
        $this->assertDatabaseCount('cvc_versions', 2);
    }

    public function test_rf_04_reopens_the_persisted_workspace_without_undoing_content(): void
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

        $this->actingAs($user)
            ->patchJson('/vault/workspace', [
                'viewport' => [
                    'x' => -180.75,
                    'y' => 41.5,
                    'zoom' => 1.6,
                ],
                'focus_entity_id' => $entityId,
            ])
            ->assertOk()
            ->assertJsonPath('workspace.focusEntityId', $entityId);

        $this->actingAs($user)
            ->get('/vault')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('workspace.viewport.x', -180.75)
                ->where('workspace.viewport.y', 41.5)
                ->where('workspace.viewport.zoom', 1.6)
                ->where('workspace.focusEntityId', $entityId));
        $this->assertDatabaseHas('cvc_documents', [
            'entity_id' => $entityId,
            'revision' => 1,
        ]);
    }
}
