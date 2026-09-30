<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ImportGameIconsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_imports_a_calamity_icon_into_managed_storage(): void
    {
        Storage::fake('public');
        config()->set('game-data.icons.disk', 'public');

        Schema::create('mods', function (Blueprint $table): void {
            $table->id();
            $table->string('mod_key');
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('mod_id');
            $table->string('global_id');
            $table->string('internal_name');
            $table->json('raw_json')->nullable();
        });

        $modId = DB::table('mods')->insertGetId(['mod_key' => 'calamity']);
        DB::table('items')->insert([
            'mod_id' => $modId,
            'global_id' => 'calamity:test-item',
            'internal_name' => 'TestItem',
            'raw_json' => json_encode(['source_file' => 'Items/TestItem.cs'], JSON_THROW_ON_ERROR),
        ]);

        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WQAAAABJRU5ErkJggg=='
        );
        $this->assertIsString($png);
        Storage::disk('public')->put('source/Items/TestItem.png', $png);

        $this->artisan('game-data:import-icons', [
            '--mod' => 'calamity',
            '--calamity-repository' => Storage::disk('public')->path('source'),
        ])->assertSuccessful();

        $this->assertDatabaseHas('game_item_assets', [
            'item_global_id' => 'calamity:test-item',
            'status' => 'ready',
            'width' => 1,
            'height' => 1,
        ]);
        Storage::disk('public')->assertExists('game-data/items/calamity/test-item.png');
    }
}
