<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\Experience;
use App\Models\Profile;
use App\Models\Project;
use App\Models\Skill;
use App\Models\SkillCategory;
use App\Models\SocialLink;
use Inertia\Inertia;
use Inertia\Response;

class AdminController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('admin/dashboard', [
            'stats' => [
                'projects' => Project::count(),
                'experiences' => Experience::count(),
                'skills' => Skill::count(),
                'messages' => ContactMessage::where('status', 'new')->count(),
            ],
            'profile' => Profile::query()->latest('updated_at')->first(),
            'projects' => Project::query()
                ->with('skills:id,name,slug')
                ->orderBy('sort_order')
                ->get(),
            'experiences' => Experience::query()
                ->with('skills:id,name,slug')
                ->orderBy('sort_order')
                ->get(),
            'skillCategories' => SkillCategory::query()
                ->with('skills')
                ->orderBy('sort_order')
                ->get(),
            'skills' => Skill::query()
                ->orderBy('sort_order')
                ->get(),
            'socialLinks' => SocialLink::query()->orderBy('sort_order')->get(),
            'messages' => ContactMessage::latest()->limit(8)->get(['id', 'name', 'email', 'subject', 'status', 'created_at']),
        ]);
    }
}
