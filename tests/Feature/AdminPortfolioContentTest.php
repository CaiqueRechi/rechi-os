<?php

namespace Tests\Feature;

use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminPortfolioContentTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admins_can_open_the_portfolio_admin(): void
    {
        $this->actingAs(User::factory()->create());

        $this->get('/admin')->assertForbidden();
    }

    public function test_admin_can_update_profile_and_technology_badge_data(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $category = SkillCategory::create(['name' => 'Backend', 'slug' => 'backend', 'sort_order' => 1]);
        $skill = Skill::create([
            'skill_category_id' => $category->id,
            'name' => 'Laravel',
            'slug' => 'laravel',
            'summary' => 'Framework PHP.',
            'sort_order' => 1,
        ]);
        Profile::create([
            'name' => 'Caique Rechi',
            'headline' => 'Backend Developer',
            'location' => 'Londrina',
            'summary' => 'Builds robust systems.',
            'availability' => 'available',
            'contact_email' => 'contato@example.com',
        ]);

        $this->actingAs($admin)
            ->patch('/admin/profile', [
                'name' => 'Caique Rechi',
                'headline' => 'Backend Engineer',
                'location' => 'Londrina, Brazil',
                'summary' => 'Curriculum-ready portfolio data.',
                'availability' => 'available',
                'contact_email' => 'contato@example.com',
                'phone' => '+55 43 99999-9999',
                'website_url' => 'https://rechi.net.br',
            ])
            ->assertRedirect();

        $this->actingAs($admin)
            ->patch("/admin/skills/{$skill->id}", [
                'skill_category_id' => $category->id,
                'name' => 'Laravel',
                'slug' => 'laravel',
                'summary' => 'Main backend framework.',
                'years_experience' => 5.5,
                'proficiency_level' => 'advanced',
                'proficiency_percent' => 92,
                'first_used_year' => 2021,
                'currently_using' => true,
                'badge_label' => 'Laravel',
                'badge_color' => '#DB633A',
                'featured' => true,
                'sort_order' => 1,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('profiles', ['headline' => 'Backend Engineer']);
        $this->assertDatabaseHas('skills', [
            'slug' => 'laravel',
            'proficiency_level' => 'advanced',
            'proficiency_percent' => 92,
            'featured' => true,
        ]);
    }

    public function test_admin_can_create_project_with_linked_technologies(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $category = SkillCategory::create(['name' => 'Backend', 'slug' => 'backend', 'sort_order' => 1]);
        $skill = Skill::create([
            'skill_category_id' => $category->id,
            'name' => 'PHP',
            'slug' => 'php',
            'years_experience' => 5,
            'proficiency_level' => 'advanced',
            'proficiency_percent' => 90,
            'currently_using' => true,
            'sort_order' => 1,
        ]);

        $this->actingAs($admin)
            ->post('/admin/projects', [
                'name' => 'IMS',
                'slug' => 'ims',
                'summary' => 'Internal management system.',
                'problem' => 'Centralize business workflows.',
                'responsibilities_text' => "REST API\nPermissions",
                'technical_decisions_text' => "Service layer\nPolicies",
                'architecture_text' => "App\nAPI\nDatabase",
                'technologies_text' => 'PHP',
                'results_text' => "Cleaner flows\nLess manual work",
                'metrics_text' => "active_users=50+\nuptime=99.9%",
                'status' => 'published',
                'period' => '2024',
                'featured' => true,
                'sort_order' => 1,
                'skill_ids' => [$skill->id],
            ])
            ->assertRedirect();

        $project = Project::where('slug', 'ims')->firstOrFail();

        $this->assertSame(['REST API', 'Permissions'], $project->responsibilities);
        $this->assertSame(['active_users' => '50+', 'uptime' => '99.9%'], $project->metrics);
        $this->assertDatabaseHas('project_skill', [
            'project_id' => $project->id,
            'skill_id' => $skill->id,
        ]);
    }
}
