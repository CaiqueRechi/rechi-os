<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('game_progression_milestones', function (Blueprint $table): void {
            $table->string('source_system', 64)->nullable()->after('milestone_type');
            $table->string('source_key', 160)->nullable()->after('source_system');
            $table->decimal('progression_value', 10, 3)->nullable()->after('source_key');
            $table->index(
                ['track_id', 'source_system', 'progression_value'],
                'game_milestone_source_progression_idx'
            );
        });

        Schema::create('game_item_unlock_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('track_id')->constrained('game_progression_tracks')->cascadeOnDelete();
            $table->string('item_global_id')->index();
            $table->string('method_key', 160);
            $table->string('method_type', 64);
            $table->text('label');
            $table->string('source_type', 64)->default('derived');
            $table->string('confidence', 32)->default('derived');
            $table->decimal('progression_value', 10, 3)->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['track_id', 'item_global_id', 'method_key'], 'game_item_unlock_rule_unique');
            $table->index(['track_id', 'progression_value'], 'game_item_unlock_progression_idx');
        });

        Schema::create('game_item_unlock_conditions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('unlock_rule_id')->constrained('game_item_unlock_rules')->cascadeOnDelete();
            $table->string('condition_group', 64)->default('all');
            $table->string('condition_type', 64);
            $table->string('operator', 32)->default('requires');
            $table->string('target_type', 64)->nullable();
            $table->string('target_key')->nullable();
            $table->decimal('numeric_value', 14, 4)->nullable();
            $table->text('text_value')->nullable();
            $table->json('value_json')->nullable();
            $table->text('label');
            $table->unsignedInteger('sort_order')->default(0);
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->index(['unlock_rule_id', 'condition_group'], 'game_unlock_condition_group_idx');
            $table->index(['condition_type', 'target_key'], 'game_unlock_condition_target_idx');
        });

        Schema::create('game_reforge_profiles', function (Blueprint $table): void {
            $table->id();
            $table->string('game_key', 64)->index();
            $table->string('reforge_key', 64);
            $table->string('name');
            $table->string('item_type', 64)->default('accessory');
            $table->unsignedTinyInteger('tier')->default(1);
            $table->decimal('defense_bonus', 8, 2)->default(0);
            $table->decimal('damage_percent', 8, 2)->default(0);
            $table->decimal('critical_chance_percent', 8, 2)->default(0);
            $table->decimal('movement_speed_percent', 8, 2)->default(0);
            $table->decimal('melee_speed_percent', 8, 2)->default(0);
            $table->decimal('mana_bonus', 8, 2)->default(0);
            $table->json('score_vector_json')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['game_key', 'reforge_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_reforge_profiles');
        Schema::dropIfExists('game_item_unlock_conditions');
        Schema::dropIfExists('game_item_unlock_rules');

        Schema::table('game_progression_milestones', function (Blueprint $table): void {
            $table->dropIndex('game_milestone_source_progression_idx');
            $table->dropColumn(['source_system', 'source_key', 'progression_value']);
        });
    }
};
