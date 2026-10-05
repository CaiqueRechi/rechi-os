<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_progression_tracks', function (Blueprint $table): void {
            $table->id();
            $table->string('track_key', 128)->unique();
            $table->string('game_key', 64)->index();
            $table->string('name');
            $table->string('game_version', 64)->nullable();
            $table->json('mod_versions_json')->nullable();
            $table->string('difficulty_key', 64)->default('any');
            $table->string('world_variant', 64)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
        });

        Schema::create('game_progression_milestones', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('track_id')->constrained('game_progression_tracks')->cascadeOnDelete();
            $table->string('milestone_key', 128);
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order');
            $table->string('milestone_type', 64)->default('progression');
            $table->json('requirements_json')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['track_id', 'milestone_key']);
            $table->index(['track_id', 'sort_order']);
        });

        Schema::create('game_milestone_dependencies', function (Blueprint $table): void {
            $table->foreignId('milestone_id')->constrained('game_progression_milestones')->cascadeOnDelete();
            $table->foreignId('depends_on_milestone_id')->constrained('game_progression_milestones')->cascadeOnDelete();
            $table->string('dependency_group', 64)->default('all');
            $table->boolean('is_required')->default(true);
            $table->primary(['milestone_id', 'depends_on_milestone_id']);
        });

        Schema::create('game_build_archetypes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('game_build_archetypes')->nullOnDelete();
            $table->string('game_key', 64)->index();
            $table->string('mod_key', 128)->nullable()->index();
            $table->string('archetype_key', 128)->unique();
            $table->string('name');
            $table->string('kind', 32)->default('subclass');
            $table->string('damage_class_key', 128)->nullable()->index();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
        });

        Schema::create('game_item_archetypes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('archetype_id')->constrained('game_build_archetypes')->cascadeOnDelete();
            $table->string('item_global_id')->index();
            $table->string('role', 64)->default('primary');
            $table->string('confidence', 32)->default('declared');
            $table->string('source_type', 64)->default('curated');
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['archetype_id', 'item_global_id', 'role'], 'game_item_archetype_unique');
        });

        Schema::create('game_item_availability', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('track_id')->constrained('game_progression_tracks')->cascadeOnDelete();
            $table->foreignId('milestone_id')->constrained('game_progression_milestones')->cascadeOnDelete();
            $table->string('item_global_id')->index();
            $table->string('availability_type', 64)->default('unknown');
            $table->string('confidence', 32)->default('unknown');
            $table->string('source_type', 64)->default('curated');
            $table->text('notes')->nullable();
            $table->json('conditions_json')->nullable();
            $table->timestamps();
            $table->index(['track_id', 'item_global_id']);
            $table->unique(
                ['track_id', 'milestone_id', 'item_global_id', 'availability_type'],
                'game_item_availability_unique'
            );
        });

        Schema::create('game_planners', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('track_id')->constrained('game_progression_tracks')->cascadeOnDelete();
            $table->foreignId('archetype_id')->constrained('game_build_archetypes')->cascadeOnDelete();
            $table->string('planner_key', 160)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('draft')->index();
            $table->string('version', 64)->default('1');
            $table->timestamp('published_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['track_id', 'archetype_id'], 'game_planner_track_archetype_unique');
        });

        Schema::create('game_planner_steps', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('planner_id')->constrained('game_planners')->cascadeOnDelete();
            $table->foreignId('milestone_id')->constrained('game_progression_milestones')->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order');
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['planner_id', 'milestone_id']);
            $table->index(['planner_id', 'sort_order']);
        });

        Schema::create('game_planner_step_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('step_id')->constrained('game_planner_steps')->cascadeOnDelete();
            $table->string('item_global_id')->index();
            $table->string('slot_type', 64)->default('weapon');
            $table->string('recommendation_tier', 32)->default('alternative');
            $table->unsignedInteger('priority')->default(100);
            $table->unsignedInteger('quantity')->default(1);
            $table->text('notes')->nullable();
            $table->string('source_url', 2048)->nullable();
            $table->json('conditions_json')->nullable();
            $table->timestamps();
            $table->unique(['step_id', 'item_global_id', 'slot_type'], 'game_planner_step_item_unique');
            $table->index(['step_id', 'slot_type', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_planner_step_items');
        Schema::dropIfExists('game_planner_steps');
        Schema::dropIfExists('game_planners');
        Schema::dropIfExists('game_item_availability');
        Schema::dropIfExists('game_item_archetypes');
        Schema::dropIfExists('game_build_archetypes');
        Schema::dropIfExists('game_milestone_dependencies');
        Schema::dropIfExists('game_progression_milestones');
        Schema::dropIfExists('game_progression_tracks');
    }
};
