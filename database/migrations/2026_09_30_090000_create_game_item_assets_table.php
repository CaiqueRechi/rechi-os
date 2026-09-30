<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('game_item_assets', function (Blueprint $table): void {
            $table->id();
            $table->string('item_global_id')->index();
            $table->string('asset_type', 32)->default('icon');
            $table->string('variant', 64)->default('default');
            $table->string('disk', 64);
            $table->string('path', 1024);
            $table->string('mime_type', 128)->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedBigInteger('byte_size')->nullable();
            $table->string('sha256', 64)->nullable()->index();
            $table->string('source_type', 64);
            $table->string('source_url', 2048)->nullable();
            $table->string('source_revision', 128)->nullable();
            $table->string('status', 32)->default('ready')->index();
            $table->text('error_message')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['item_global_id', 'asset_type', 'variant'], 'game_item_asset_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_item_assets');
    }
};
