<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GamePlannerBuilderTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_derives_a_timeline_from_acquisition_dependencies_and_power_changes(): void
    {
        $this->createCatalogSchema();
        $this->seedLogicalProgressionFixture();

        $this->artisan('game-data:build-planners')->assertSuccessful();

        $this->assertDatabaseHas('game_progression_tracks', [
            'track_key' => 'terraria-calamity-auto-v1',
        ]);
        $this->assertDatabaseHas('game_item_availability', [
            'item_global_id' => 'terraria:forged_blade',
            'availability_type' => 'crafting',
            'confidence' => 'derived',
        ]);
        $containerMilestone = DB::table('game_item_availability as availability')
            ->join('game_progression_milestones as milestone', 'milestone.id', '=', 'availability.milestone_id')
            ->where('availability.item_global_id', 'terraria:bag_blade')
            ->value('milestone.sort_order');
        $this->assertSame(100, $containerMilestone);
        $conditionalDropMilestone = DB::table('game_item_availability as availability')
            ->join('game_progression_milestones as milestone', 'milestone.id', '=', 'availability.milestone_id')
            ->where('availability.item_global_id', 'terraria:conditional_blade')
            ->value('milestone.sort_order');
        $this->assertSame(100, $conditionalDropMilestone);
        $unresolvedBossMilestone = DB::table('game_item_availability as availability')
            ->join('game_progression_milestones as milestone', 'milestone.id', '=', 'availability.milestone_id')
            ->where('availability.item_global_id', 'terraria:unresolved_boss_blade')
            ->value('milestone.sort_order');
        $this->assertSame(100, $unresolvedBossMilestone);
        $recipeGateMilestone = DB::table('game_item_availability as availability')
            ->join('game_progression_milestones as milestone', 'milestone.id', '=', 'availability.milestone_id')
            ->where('availability.item_global_id', 'terraria:hardmode_recipe_blade')
            ->value('milestone.sort_order');
        $this->assertSame(700, $recipeGateMilestone);
        $dependencyGated = DB::table('game_item_availability')
            ->where('item_global_id', 'terraria:dependency_gated_item')->first();
        $this->assertNotNull($dependencyGated);
        $this->assertSame('crafting', $dependencyGated->availability_type);
        $this->assertSame(1500, json_decode($dependencyGated->conditions_json, true, 512, JSON_THROW_ON_ERROR)['rank']);
        $vendorItem = DB::table('game_item_availability')
            ->where('item_global_id', 'terraria:vendor_component')->first();
        $this->assertNotNull($vendorItem);
        $this->assertSame('vendor', $vendorItem->availability_type);
        $this->assertSame(0, json_decode($vendorItem->conditions_json, true, 512, JSON_THROW_ON_ERROR)['rank']);
        $hardmodeNpcDropRank = $this->availabilityRank('terraria:warlock_charm');
        $this->assertSame(700, $hardmodeNpcDropRank);
        $wallRank = $this->availabilityRank('terraria:wall_drop');
        $mechanicalRank = $this->availabilityRank('terraria:mechanical_drop');
        $moonLordRank = $this->availabilityRank('terraria:moon_lord_drop');
        $this->assertSame(700, $wallRank);
        $this->assertGreaterThan($wallRank, $mechanicalRank);
        $this->assertLessThan($moonLordRank, $mechanicalRank);
        $this->assertSame(1800, $moonLordRank);
        $this->assertDatabaseHas('game_planners', [
            'planner_key' => 'melee-generated',
            'status' => 'published',
            'version' => 'unlock-graph-boss-checklist-v5',
        ]);
        $this->assertDatabaseHas('game_planner_step_items', [
            'item_global_id' => 'terraria:copper_sword',
            'slot_type' => 'weapon',
            'recommendation_tier' => 'core',
        ]);
        $this->assertDatabaseMissing('game_planner_step_items', [
            'item_global_id' => 'terraria:unobtainable_blade',
        ]);
        $this->assertDatabaseMissing('game_planner_step_items', [
            'item_global_id' => 'terraria:unresolved_source_blade',
        ]);
        foreach ([
            'terraria:wood_helmet' => 'armor_head',
            'terraria:wood_breastplate' => 'armor_body',
            'terraria:wood_greaves' => 'armor_legs',
            'terraria:running_charm' => 'accessory',
        ] as $globalId => $slotType) {
            $this->assertDatabaseHas('game_planner_step_items', [
                'item_global_id' => $globalId,
                'slot_type' => $slotType,
            ]);
        }
        $this->assertDatabaseHas('game_planner_step_items', [
            'item_global_id' => 'terraria:test_flamethrower',
            'slot_type' => 'weapon',
        ]);
        $this->assertDatabaseHas('game_planner_step_items', [
            'item_global_id' => 'terraria:test_spellbook',
            'slot_type' => 'weapon',
        ]);

        $meleePlannerId = DB::table('game_planners')->where('planner_key', 'melee-generated')->value('id');
        $firstStepId = DB::table('game_planner_steps')->where('planner_id', $meleePlannerId)->orderBy('sort_order')->value('id');
        $this->assertSame(5, DB::table('game_planner_step_items')->where('step_id', $firstStepId)->where('slot_type', 'accessory')->count());
        $trackId = DB::table('game_progression_tracks')->where('track_key', 'terraria-calamity-auto-v1')->value('id');
        $this->assertSame(
            DB::table('game_progression_milestones')->where('track_id', $trackId)->count(),
            DB::table('game_planner_steps')->where('planner_id', $meleePlannerId)->count()
        );
    }

    private function createCatalogSchema(): void
    {
        Schema::create('mods', function (Blueprint $table): void {
            $table->id();
            $table->string('mod_key');
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('mod_id');
            $table->string('global_id');
            $table->string('display_name');
            $table->text('tooltip')->nullable();
            $table->text('description')->nullable();
            $table->string('rarity_text')->nullable();
            $table->json('raw_json')->nullable();
        });
        Schema::create('item_stats', function (Blueprint $table): void {
            $table->foreignId('item_id');
            $table->string('stat_key');
            $table->decimal('numeric_value', 18, 6)->nullable();
            $table->text('text_value')->nullable();
            $table->text('raw_value')->nullable();
        });
        Schema::create('item_properties', function (Blueprint $table): void {
            $table->foreignId('item_id');
            $table->string('property_key');
            $table->boolean('boolean_value')->nullable();
            $table->decimal('numeric_value', 18, 6)->nullable();
            $table->text('text_value')->nullable();
            $table->text('raw_value')->nullable();
        });
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->string('category_key');
        });
        Schema::create('item_categories', function (Blueprint $table): void {
            $table->foreignId('item_id');
            $table->foreignId('category_id');
        });
        Schema::create('combat_classes', function (Blueprint $table): void {
            $table->id();
            $table->string('class_key');
        });
        Schema::create('item_combat_classes', function (Blueprint $table): void {
            $table->foreignId('item_id');
            $table->foreignId('combat_class_id');
        });
        Schema::create('tags', function (Blueprint $table): void {
            $table->id();
            $table->string('tag_key');
        });
        Schema::create('item_tags', function (Blueprint $table): void {
            $table->foreignId('item_id');
            $table->foreignId('tag_id');
        });
        Schema::create('progression_stages', function (Blueprint $table): void {
            $table->id();
            $table->string('global_id')->nullable();
            $table->integer('sort_order');
        });
        Schema::create('item_progression', function (Blueprint $table): void {
            $table->foreignId('item_id');
            $table->foreignId('progression_stage_id');
        });
        Schema::create('npcs', function (Blueprint $table): void {
            $table->id();
            $table->string('display_name');
        });
        Schema::create('npc_stats', function (Blueprint $table): void {
            $table->foreignId('npc_id');
            $table->string('stat_key');
            $table->decimal('numeric_value', 18, 6)->nullable();
        });
        Schema::create('bosses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('npc_id');
        });
        Schema::create('drops', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('item_id')->nullable();
            $table->foreignId('npc_id')->nullable();
            $table->foreignId('source_item_id')->nullable();
            $table->string('unresolved_source_name')->nullable();
            $table->string('source_type');
            $table->text('condition_text')->nullable();
            $table->json('conditions_json')->nullable();
        });
        Schema::create('recipes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('result_item_id')->nullable();
            $table->boolean('is_historical')->default(false);
            $table->json('raw_json')->nullable();
        });
        Schema::create('recipe_ingredients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recipe_id');
            $table->foreignId('ingredient_item_id')->nullable();
            $table->unsignedBigInteger('recipe_group_id')->nullable();
            $table->string('unresolved_name')->nullable();
        });
        Schema::create('recipe_group_members', function (Blueprint $table): void {
            $table->unsignedBigInteger('recipe_group_id');
            $table->foreignId('item_id');
        });
        Schema::create('crafting_stations', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
        });
        Schema::create('recipe_stations', function (Blueprint $table): void {
            $table->foreignId('recipe_id');
            $table->foreignId('station_id');
        });
        Schema::create('recipe_conditions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recipe_id');
            $table->string('condition_type')->nullable();
            $table->string('condition_key')->nullable();
            $table->text('description')->nullable();
            $table->json('value_json')->nullable();
        });
    }

    private function seedLogicalProgressionFixture(): void
    {
        DB::table('mods')->insert(['id' => 1, 'mod_key' => 'terraria']);
        DB::table('items')->insert([
            ['id' => 1, 'mod_id' => 1, 'global_id' => 'terraria:copper_sword', 'display_name' => 'Copper Sword'],
            ['id' => 2, 'mod_id' => 1, 'global_id' => 'terraria:eye_blade', 'display_name' => 'Eye Blade'],
            ['id' => 3, 'mod_id' => 1, 'global_id' => 'terraria:forged_blade', 'display_name' => 'Forged Blade'],
            ['id' => 4, 'mod_id' => 1, 'global_id' => 'terraria:demon_ore', 'display_name' => 'Demon Ore'],
            ['id' => 5, 'mod_id' => 1, 'global_id' => 'terraria:unobtainable_blade', 'display_name' => 'Unobtainable Blade'],
            ['id' => 6, 'mod_id' => 1, 'global_id' => 'terraria:eye_bag', 'display_name' => 'Eye Bag'],
            ['id' => 7, 'mod_id' => 1, 'global_id' => 'terraria:bag_blade', 'display_name' => 'Bag Blade'],
            ['id' => 8, 'mod_id' => 1, 'global_id' => 'terraria:conditional_blade', 'display_name' => 'Conditional Blade'],
            ['id' => 9, 'mod_id' => 1, 'global_id' => 'terraria:unresolved_boss_blade', 'display_name' => 'Unresolved Boss Blade'],
            ['id' => 10, 'mod_id' => 1, 'global_id' => 'terraria:unresolved_source_blade', 'display_name' => 'Unresolved Source Blade'],
            ['id' => 11, 'mod_id' => 1, 'global_id' => 'terraria:hardmode_recipe_blade', 'display_name' => 'Hardmode Recipe Blade'],
        ]);
        DB::table('items')->insert([
            ['id' => 12, 'mod_id' => 1, 'global_id' => 'terraria:wood_helmet', 'display_name' => 'Wood Helmet', 'tooltip' => null],
            ['id' => 13, 'mod_id' => 1, 'global_id' => 'terraria:wood_breastplate', 'display_name' => 'Wood Breastplate', 'tooltip' => null],
            ['id' => 14, 'mod_id' => 1, 'global_id' => 'terraria:wood_greaves', 'display_name' => 'Wood Greaves', 'tooltip' => null],
            ['id' => 15, 'mod_id' => 1, 'global_id' => 'terraria:running_charm', 'display_name' => 'Running Charm', 'tooltip' => '5% increased movement speed'],
            ['id' => 16, 'mod_id' => 1, 'global_id' => 'terraria:lucky_charm', 'display_name' => 'Lucky Charm', 'tooltip' => '4% increased critical strike chance'],
            ['id' => 17, 'mod_id' => 1, 'global_id' => 'terraria:warding_charm', 'display_name' => 'Warding Charm', 'tooltip' => '3% damage reduction'],
            ['id' => 18, 'mod_id' => 1, 'global_id' => 'terraria:swift_charm', 'display_name' => 'Swift Charm', 'tooltip' => '2% increased movement speed'],
            ['id' => 19, 'mod_id' => 1, 'global_id' => 'terraria:minor_charm', 'display_name' => 'Minor Charm', 'tooltip' => '1% increased damage'],
            ['id' => 20, 'mod_id' => 1, 'global_id' => 'terraria:test_flamethrower', 'display_name' => 'Test Flamethrower', 'tooltip' => 'Uses gel for ammo'],
            ['id' => 21, 'mod_id' => 1, 'global_id' => 'terraria:test_spellbook', 'display_name' => 'Test Spellbook', 'tooltip' => 'Casts a test spell'],
            ['id' => 22, 'mod_id' => 1, 'global_id' => 'terraria:dependency_gated_item', 'display_name' => 'Dependency Gated Item', 'tooltip' => null],
            ['id' => 23, 'mod_id' => 1, 'global_id' => 'terraria:late_material', 'display_name' => 'Late Material', 'tooltip' => null],
        ]);
        DB::table('items')->insert([
            'id' => 24,
            'mod_id' => 1,
            'global_id' => 'terraria:vendor_component',
            'display_name' => 'Vendor Component',
            'raw_json' => '{"buy":"10 Gold","tag":"vendor^vendor:Test Merchant"}',
        ]);
        DB::table('items')->insert([
            ['id' => 25, 'mod_id' => 1, 'global_id' => 'terraria:wall_drop', 'display_name' => 'Wall Drop'],
            ['id' => 26, 'mod_id' => 1, 'global_id' => 'terraria:mechanical_drop', 'display_name' => 'Mechanical Drop'],
            ['id' => 27, 'mod_id' => 1, 'global_id' => 'terraria:moon_lord_drop', 'display_name' => 'Moon Lord Drop'],
        ]);
        DB::table('items')->insert([
            'id' => 28,
            'mod_id' => 1,
            'global_id' => 'terraria:warlock_charm',
            'display_name' => 'Warlock Charm',
            'tooltip' => '8% increased summon damage',
        ]);
        DB::table('combat_classes')->insert([
            ['id' => 1, 'class_key' => 'melee'],
            ['id' => 2, 'class_key' => 'ranged'],
            ['id' => 3, 'class_key' => 'magic'],
        ]);
        DB::table('item_combat_classes')->insert(array_map(
            static fn (int $itemId): array => ['item_id' => $itemId, 'combat_class_id' => 1],
            [1, 2, 3, 5, 7, 8, 9, 10, 11]
        ));
        DB::table('item_combat_classes')->insert([
            ['item_id' => 20, 'combat_class_id' => 2],
            ['item_id' => 21, 'combat_class_id' => 3],
        ]);
        foreach ([[1, 10, 30], [2, 20, 25], [3, 40, 20], [5, 100, 10], [7, 80, 15], [8, 90, 15], [9, 120, 12], [10, 1000, 5], [11, 150, 10]] as [$itemId, $damage, $useTime]) {
            DB::table('item_stats')->insert([
                ['item_id' => $itemId, 'stat_key' => 'damage', 'numeric_value' => $damage],
                ['item_id' => $itemId, 'stat_key' => 'use_time', 'numeric_value' => $useTime],
            ]);
        }
        foreach ([[12, 1], [13, 3], [14, 1]] as [$itemId, $defense]) {
            DB::table('item_stats')->insert([
                'item_id' => $itemId,
                'stat_key' => 'defense',
                'numeric_value' => $defense,
            ]);
        }
        foreach ([[20, 35, 30], [21, 28, 24]] as [$itemId, $damage, $useTime]) {
            DB::table('item_stats')->insert([
                ['item_id' => $itemId, 'stat_key' => 'damage', 'numeric_value' => $damage],
                ['item_id' => $itemId, 'stat_key' => 'use_time', 'numeric_value' => $useTime],
            ]);
        }
        DB::table('categories')->insert([
            ['id' => 1, 'category_key' => 'armor'],
            ['id' => 2, 'category_key' => 'accessory'],
            ['id' => 3, 'category_key' => 'spell_books'],
        ]);
        DB::table('item_categories')->insert([
            ['item_id' => 12, 'category_id' => 1],
            ['item_id' => 13, 'category_id' => 1],
            ['item_id' => 14, 'category_id' => 1],
            ['item_id' => 15, 'category_id' => 2],
            ['item_id' => 16, 'category_id' => 2],
            ['item_id' => 17, 'category_id' => 2],
            ['item_id' => 18, 'category_id' => 2],
            ['item_id' => 19, 'category_id' => 2],
            ['item_id' => 21, 'category_id' => 3],
            ['item_id' => 28, 'category_id' => 2],
        ]);
        DB::table('item_properties')->insert([
            ['item_id' => 12, 'property_key' => 'bodyslot', 'text_value' => 'helmet'],
            ['item_id' => 13, 'property_key' => 'bodyslot', 'text_value' => 'shirt'],
            ['item_id' => 14, 'property_key' => 'bodyslot', 'text_value' => 'pants'],
        ]);
        DB::table('progression_stages')->insert([
            ['id' => 1, 'sort_order' => 200],
            ['id' => 2, 'sort_order' => 250],
        ]);
        DB::table('item_progression')->insert([
            ['item_id' => 22, 'progression_stage_id' => 1],
            ['item_id' => 23, 'progression_stage_id' => 2],
        ]);

        DB::table('npcs')->insert([
            ['id' => 1, 'display_name' => 'King Slime'],
            ['id' => 2, 'display_name' => 'Wall of Flesh'],
            ['id' => 3, 'display_name' => 'The Destroyer'],
            ['id' => 4, 'display_name' => 'Moon Lord'],
            ['id' => 5, 'display_name' => 'Goblin Warlock'],
        ]);
        DB::table('bosses')->insert([
            ['id' => 1, 'npc_id' => 1],
            ['id' => 2, 'npc_id' => 2],
            ['id' => 3, 'npc_id' => 3],
            ['id' => 4, 'npc_id' => 4],
        ]);
        DB::table('npc_stats')->insert([
            ['npc_id' => 1, 'stat_key' => 'life', 'numeric_value' => 1000],
            ['npc_id' => 1, 'stat_key' => 'damage', 'numeric_value' => 20],
            ['npc_id' => 1, 'stat_key' => 'defense', 'numeric_value' => 10],
            ['npc_id' => 2, 'stat_key' => 'life', 'numeric_value' => 10000],
            ['npc_id' => 2, 'stat_key' => 'damage', 'numeric_value' => 50],
            ['npc_id' => 2, 'stat_key' => 'defense', 'numeric_value' => 20],
            ['npc_id' => 3, 'stat_key' => 'life', 'numeric_value' => 80000],
            ['npc_id' => 3, 'stat_key' => 'damage', 'numeric_value' => 70],
            ['npc_id' => 3, 'stat_key' => 'defense', 'numeric_value' => 0],
            ['npc_id' => 4, 'stat_key' => 'life', 'numeric_value' => 145000],
            ['npc_id' => 4, 'stat_key' => 'damage', 'numeric_value' => 150],
            ['npc_id' => 4, 'stat_key' => 'defense', 'numeric_value' => 70],
        ]);
        DB::table('drops')->insert([
            ['id' => 1, 'item_id' => 1, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 2, 'item_id' => 2, 'npc_id' => 1, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => null],
            ['id' => 3, 'item_id' => 4, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 4, 'item_id' => 6, 'npc_id' => 1, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => null],
            ['id' => 5, 'item_id' => 7, 'npc_id' => null, 'source_item_id' => 6, 'unresolved_source_name' => null, 'source_type' => 'container', 'condition_text' => null],
            ['id' => 6, 'item_id' => 8, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => 'Post-King Slime'],
            ['id' => 7, 'item_id' => 9, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => 'King Slime', 'source_type' => 'npc', 'condition_text' => null],
            ['id' => 8, 'item_id' => 10, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => 'Final Mystery', 'source_type' => 'npc', 'condition_text' => null],
            ['id' => 9, 'item_id' => 12, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 10, 'item_id' => 13, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 11, 'item_id' => 14, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 12, 'item_id' => 15, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 13, 'item_id' => 16, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 14, 'item_id' => 17, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 15, 'item_id' => 18, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 16, 'item_id' => 19, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 17, 'item_id' => 20, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 18, 'item_id' => 21, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 19, 'item_id' => 23, 'npc_id' => null, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'world', 'condition_text' => null],
            ['id' => 20, 'item_id' => 25, 'npc_id' => 2, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => null],
            ['id' => 21, 'item_id' => 26, 'npc_id' => 3, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => null],
            ['id' => 22, 'item_id' => 27, 'npc_id' => 4, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => null],
            ['id' => 23, 'item_id' => 28, 'npc_id' => 5, 'source_item_id' => null, 'unresolved_source_name' => null, 'source_type' => 'npc_drop', 'condition_text' => null],
        ]);
        DB::table('recipes')->insert([
            ['id' => 1, 'result_item_id' => 3, 'is_historical' => false, 'raw_json' => null],
            ['id' => 2, 'result_item_id' => 11, 'is_historical' => false, 'raw_json' => '{"station":"Hardmode Anvil"}'],
            ['id' => 3, 'result_item_id' => 22, 'is_historical' => false, 'raw_json' => null],
        ]);
        DB::table('recipe_ingredients')->insert([
            ['id' => 1, 'recipe_id' => 1, 'ingredient_item_id' => 2],
            ['id' => 2, 'recipe_id' => 1, 'ingredient_item_id' => 4],
            ['id' => 3, 'recipe_id' => 2, 'ingredient_item_id' => 4],
            ['id' => 4, 'recipe_id' => 3, 'ingredient_item_id' => 23],
            ['id' => 5, 'recipe_id' => 3, 'ingredient_item_id' => 24],
        ]);
    }

    private function availabilityRank(string $globalId): int
    {
        $conditions = DB::table('game_item_availability')->where('item_global_id', $globalId)
            ->value('conditions_json');
        $this->assertIsString($conditions);

        return (int) json_decode($conditions, true, 512, JSON_THROW_ON_ERROR)['rank'];
    }
}
