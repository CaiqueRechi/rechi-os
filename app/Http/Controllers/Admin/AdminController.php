<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Models\Experience;
use App\Models\Project;
use App\Models\Skill;
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
            'messages' => ContactMessage::latest()->limit(8)->get(['id', 'name', 'email', 'subject', 'status', 'created_at']),
        ]);
    }
}
