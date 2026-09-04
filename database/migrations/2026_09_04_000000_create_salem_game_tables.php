<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salem_players', function (Blueprint $table) {
            $table->id();
            $table->uuid('visitor_key')->unique();
            $table->string('ip_hash')->nullable()->index();
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('salem_game_saves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->unique()->constrained('salem_players')->cascadeOnDelete();
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('xp')->default(0);
            $table->unsignedInteger('cozy_points')->default(0);
            $table->string('current_biome')->default('main');
            $table->string('pet_state')->default('idle');
            $table->json('state_payload')->nullable();
            $table->unsignedSmallInteger('save_version')->default(1);
            $table->timestamp('last_progress_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('salem_unlocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained('salem_players')->cascadeOnDelete();
            $table->string('unlock_type');
            $table->string('unlock_key');
            $table->json('metadata')->nullable();
            $table->timestamp('unlocked_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['player_id', 'unlock_type', 'unlock_key']);
            $table->index(['unlock_type', 'unlock_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salem_unlocks');
        Schema::dropIfExists('salem_game_saves');
        Schema::dropIfExists('salem_players');
    }
};
