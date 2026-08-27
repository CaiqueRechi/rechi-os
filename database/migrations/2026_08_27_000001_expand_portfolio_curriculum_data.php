<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('contact_email');
            $table->string('website_url')->nullable()->after('phone');
        });

        Schema::table('experiences', function (Blueprint $table) {
            $table->string('location')->nullable()->after('company');
            $table->string('employment_type')->nullable()->after('location');
            $table->json('achievements')->nullable()->after('summary');
        });

        Schema::table('skills', function (Blueprint $table) {
            $table->decimal('years_experience', 4, 1)->default(0)->after('summary');
            $table->string('proficiency_level')->default('working')->after('years_experience');
            $table->unsignedTinyInteger('proficiency_percent')->default(50)->after('proficiency_level');
            $table->unsignedSmallInteger('first_used_year')->nullable()->after('proficiency_percent');
            $table->unsignedSmallInteger('last_used_year')->nullable()->after('first_used_year');
            $table->boolean('currently_using')->default(true)->after('last_used_year');
            $table->string('badge_label')->nullable()->after('currently_using');
            $table->string('badge_color', 24)->nullable()->after('badge_label');
            $table->string('icon')->nullable()->after('badge_color');
            $table->boolean('featured')->default(false)->index()->after('icon');
        });

        Schema::create('experience_skill', function (Blueprint $table) {
            $table->foreignId('experience_id')->constrained()->cascadeOnDelete();
            $table->foreignId('skill_id')->constrained()->cascadeOnDelete();
            $table->string('context')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->primary(['experience_id', 'skill_id']);
        });

        Schema::create('project_skill', function (Blueprint $table) {
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('skill_id')->constrained()->cascadeOnDelete();
            $table->string('context')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->primary(['project_id', 'skill_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_skill');
        Schema::dropIfExists('experience_skill');

        Schema::table('skills', function (Blueprint $table) {
            $table->dropColumn([
                'years_experience',
                'proficiency_level',
                'proficiency_percent',
                'first_used_year',
                'last_used_year',
                'currently_using',
                'badge_label',
                'badge_color',
                'icon',
                'featured',
            ]);
        });

        Schema::table('experiences', function (Blueprint $table) {
            $table->dropColumn(['location', 'employment_type', 'achievements']);
        });

        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn(['phone', 'website_url']);
        });
    }
};
