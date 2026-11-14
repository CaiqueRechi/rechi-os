<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salem_players', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->after('id')
                ->unique()
                ->constrained()
                ->cascadeOnDelete();
        });

        Schema::create('screen_access_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('screen_key', 100);
            $table->string('access_level', 16)->default('none');
            $table->timestamps();

            $table->unique(['user_id', 'screen_key']);
            $table->index(['screen_key', 'access_level']);
        });

        Schema::create('salem_shop_items', function (Blueprint $table) {
            $table->id();
            $table->string('item_key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('buy_price')->nullable();
            $table->unsignedInteger('sell_price')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('salem_player_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('salem_players')->cascadeOnDelete();
            $table->foreignId('shop_item_id')->constrained('salem_shop_items')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamps();

            $table->unique(['player_id', 'shop_item_id']);
        });

        Schema::create('salem_market_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('salem_players')->cascadeOnDelete();
            $table->foreignId('shop_item_id')->constrained('salem_shop_items')->restrictOnDelete();
            $table->string('type', 12);
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price');
            $table->unsignedInteger('total_price');
            $table->unsignedInteger('balance_before');
            $table->unsignedInteger('balance_after');
            $table->timestamps();

            $table->index(['player_id', 'created_at']);
        });

        $now = now();

        DB::table('salem_shop_items')->insert([
            [
                'item_key' => 'cozy-cushion',
                'name' => 'Almofada aconchegante',
                'description' => 'Uma almofada macia para descansar entre as ilhas.',
                'buy_price' => 35,
                'sell_price' => 18,
                'is_active' => true,
                'metadata' => json_encode(['category' => 'comfort']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'item_key' => 'moon-lantern',
                'name' => 'Lanterna lunar',
                'description' => 'Uma pequena luz para acompanhar Salém durante a noite.',
                'buy_price' => 50,
                'sell_price' => 25,
                'is_active' => true,
                'metadata' => json_encode(['category' => 'decoration']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'item_key' => 'laptop-sticker',
                'name' => 'Adesivo de notebook',
                'description' => 'Um adesivo colecionável para o cantinho de programação.',
                'buy_price' => 20,
                'sell_price' => 10,
                'is_active' => true,
                'metadata' => json_encode(['category' => 'collectible']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        $adminIds = DB::table('users')->where('is_admin', true)->pluck('id');
        $permissions = [];

        foreach ($adminIds as $userId) {
            foreach (['library', 'salem'] as $screenKey) {
                $permissions[] = [
                    'user_id' => $userId,
                    'screen_key' => $screenKey,
                    'access_level' => 'write',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if ($permissions !== []) {
            DB::table('screen_access_permissions')->insert($permissions);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('salem_market_transactions');
        Schema::dropIfExists('salem_player_items');
        Schema::dropIfExists('salem_shop_items');
        Schema::dropIfExists('screen_access_permissions');

        Schema::table('salem_players', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
