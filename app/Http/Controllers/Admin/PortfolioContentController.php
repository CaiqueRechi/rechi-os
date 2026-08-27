<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Experience;
use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\SocialLink;
use App\Services\PortfolioCacheService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PortfolioContentController extends Controller
{
    public function __construct(private readonly PortfolioCacheService $cache) {}

    public function updateProfile(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'headline' => ['required', 'string', 'max:255'],
            'location' => ['required', 'string', 'max:255'],
            'summary' => ['required', 'string'],
            'availability' => ['required', 'string', 'max:255'],
            'avatar_path' => ['nullable', 'string', 'max:255'],
            'resume_url' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'website_url' => ['nullable', 'string', 'max:255'],
            'ai_base_prompt' => ['nullable', 'string'],
        ]);

        $profile = Profile::query()->latest('updated_at')->first();
        $profile ? $profile->update($data) : Profile::query()->create($data);

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Profile saved.']);
    }

    public function storeSkillCategory(Request $request): RedirectResponse
    {
        SkillCategory::query()->create($this->categoryData($request));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Category created.']);
    }

    public function updateSkillCategory(Request $request, SkillCategory $category): RedirectResponse
    {
        $category->update($this->categoryData($request, $category));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Category saved.']);
    }

    public function destroySkillCategory(SkillCategory $category): RedirectResponse
    {
        $category->delete();

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Category removed.']);
    }

    public function storeSkill(Request $request): RedirectResponse
    {
        Skill::query()->create($this->skillData($request));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Technology created.']);
    }

    public function updateSkill(Request $request, Skill $skill): RedirectResponse
    {
        $skill->update($this->skillData($request, $skill));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Technology saved.']);
    }

    public function destroySkill(Skill $skill): RedirectResponse
    {
        $skill->delete();

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Technology removed.']);
    }

    public function storeExperience(Request $request): RedirectResponse
    {
        $experience = Experience::query()->create($this->experienceData($request));
        $experience->skills()->sync($this->skillSyncData($request));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Experience created.']);
    }

    public function updateExperience(Request $request, Experience $experience): RedirectResponse
    {
        $experience->update($this->experienceData($request));
        $experience->skills()->sync($this->skillSyncData($request));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Experience saved.']);
    }

    public function destroyExperience(Experience $experience): RedirectResponse
    {
        $experience->delete();

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Experience removed.']);
    }

    public function storeProject(Request $request): RedirectResponse
    {
        $project = Project::query()->create($this->projectData($request));
        $project->skills()->sync($this->skillSyncData($request));

        $this->forgetProject($project);

        return back()->with('toast', ['type' => 'success', 'message' => 'Project created.']);
    }

    public function updateProject(Request $request, Project $project): RedirectResponse
    {
        $project->update($this->projectData($request, $project));
        $project->skills()->sync($this->skillSyncData($request));

        $this->forgetProject($project);

        return back()->with('toast', ['type' => 'success', 'message' => 'Project saved.']);
    }

    public function destroyProject(Project $project): RedirectResponse
    {
        $project->delete();

        $this->forgetProject($project);

        return back()->with('toast', ['type' => 'success', 'message' => 'Project removed.']);
    }

    public function storeSocialLink(Request $request): RedirectResponse
    {
        SocialLink::query()->create($this->socialLinkData($request));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Link created.']);
    }

    public function updateSocialLink(Request $request, SocialLink $socialLink): RedirectResponse
    {
        $socialLink->update($this->socialLinkData($request));

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Link saved.']);
    }

    public function destroySocialLink(SocialLink $socialLink): RedirectResponse
    {
        $socialLink->delete();

        $this->forgetPortfolio();

        return back()->with('toast', ['type' => 'success', 'message' => 'Link removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function categoryData(Request $request, ?SkillCategory $category = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'required',
                'string',
                'max:255',
                Rule::unique('skill_categories', 'slug')->ignore($category),
            ],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function skillData(Request $request, ?Skill $skill = null): array
    {
        return $request->validate([
            'skill_category_id' => ['required', 'exists:skill_categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('skills', 'slug')->ignore($skill)],
            'summary' => ['nullable', 'string'],
            'years_experience' => ['required', 'numeric', 'min:0', 'max:99.9'],
            'proficiency_level' => ['required', 'string', 'max:255'],
            'proficiency_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'first_used_year' => ['nullable', 'integer', 'min:1990', 'max:2100'],
            'last_used_year' => ['nullable', 'integer', 'min:1990', 'max:2100'],
            'currently_using' => ['required', 'boolean'],
            'badge_label' => ['nullable', 'string', 'max:255'],
            'badge_color' => ['nullable', 'string', 'max:24'],
            'icon' => ['nullable', 'string', 'max:255'],
            'featured' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function experienceData(Request $request): array
    {
        $data = $request->validate([
            'role' => ['required', 'string', 'max:255'],
            'company' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'employment_type' => ['nullable', 'string', 'max:255'],
            'summary' => ['required', 'string'],
            'achievements_text' => ['nullable', 'string'],
            'started_at' => ['required', 'date'],
            'ended_at' => ['nullable', 'date'],
            'current' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
            'skill_ids' => ['nullable', 'array'],
            'skill_ids.*' => ['integer', 'exists:skills,id'],
        ]);

        return [
            'role' => $data['role'],
            'company' => $data['company'],
            'location' => $data['location'] ?? null,
            'employment_type' => $data['employment_type'] ?? null,
            'summary' => $data['summary'],
            'achievements' => $this->lines($request->string('achievements_text')->toString()),
            'started_at' => $data['started_at'],
            'ended_at' => $data['ended_at'] ?? null,
            'current' => $request->boolean('current'),
            'sort_order' => $data['sort_order'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function projectData(Request $request, ?Project $project = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('projects', 'slug')->ignore($project)],
            'summary' => ['required', 'string', 'max:255'],
            'problem' => ['required', 'string'],
            'responsibilities_text' => ['nullable', 'string'],
            'technical_decisions_text' => ['nullable', 'string'],
            'architecture_text' => ['nullable', 'string'],
            'technologies_text' => ['nullable', 'string'],
            'results_text' => ['nullable', 'string'],
            'metrics_text' => ['nullable', 'string'],
            'demo_url' => ['nullable', 'string', 'max:255'],
            'repository_url' => ['nullable', 'string', 'max:255'],
            'status' => ['required', Rule::in(['draft', 'published', 'archived'])],
            'period' => ['required', 'string', 'max:255'],
            'featured' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
            'published_at' => ['nullable', 'date'],
            'skill_ids' => ['nullable', 'array'],
            'skill_ids.*' => ['integer', 'exists:skills,id'],
        ]);

        return [
            'name' => $data['name'],
            'slug' => $data['slug'],
            'summary' => $data['summary'],
            'problem' => $data['problem'],
            'responsibilities' => $this->lines($request->string('responsibilities_text')->toString()),
            'technical_decisions' => $this->lines($request->string('technical_decisions_text')->toString()),
            'architecture' => $this->lines($request->string('architecture_text')->toString()),
            'technologies' => $this->lines($request->string('technologies_text')->toString()),
            'results' => $this->lines($request->string('results_text')->toString()),
            'metrics' => $this->metrics($request->string('metrics_text')->toString()),
            'demo_url' => $data['demo_url'] ?? null,
            'repository_url' => $data['repository_url'] ?? null,
            'status' => $data['status'],
            'period' => $data['period'],
            'featured' => $request->boolean('featured'),
            'sort_order' => $data['sort_order'],
            'published_at' => $data['published_at'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function socialLinkData(Request $request): array
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'url' => ['required', 'string', 'max:255'],
            'icon' => ['nullable', 'string', 'max:255'],
            'public' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:65535'],
        ]);

        return [
            ...$data,
            'public' => $request->boolean('public'),
        ];
    }

    /**
     * @return array<int, array{sort_order: int}>
     */
    private function skillSyncData(Request $request): array
    {
        $skillIds = $request->input('skill_ids', []);

        if (! is_array($skillIds)) {
            return [];
        }

        $sync = [];
        $sortOrder = 1;

        foreach ($skillIds as $id) {
            if (! is_numeric($id)) {
                continue;
            }

            $sync[(int) $id] = ['sort_order' => $sortOrder++];
        }

        return $sync;
    }

    /**
     * @return array<int, string>
     */
    private function lines(string $value): array
    {
        return collect(preg_split('/\R/', $value) ?: [])
            ->map(fn (string $line) => trim($line))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array<string, string>
     */
    private function metrics(string $value): array
    {
        return collect($this->lines($value))
            ->mapWithKeys(function (string $line): array {
                [$key, $content] = array_pad(explode('=', $line, 2), 2, '');
                $slug = str(trim($key))->slug('_')->toString();

                return $slug && trim($content) !== '' ? [$slug => trim($content)] : [];
            })
            ->all();
    }

    private function forgetProject(Project $project): void
    {
        $this->cache->forgetProject($project->slug);
        $this->forgetPortfolio();
    }

    private function forgetPortfolio(): void
    {
        $this->cache->forgetPublicPortfolio();
    }
}
