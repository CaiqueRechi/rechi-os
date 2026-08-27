<?php

namespace App\Http\Resources;

use App\Models\Skill;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Skill */
class SkillResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->name,
            'slug' => $this->slug,
            'summary' => $this->summary,
            'years_experience' => (float) $this->years_experience,
            'proficiency_level' => $this->proficiency_level,
            'proficiency_percent' => $this->proficiency_percent,
            'first_used_year' => $this->first_used_year,
            'last_used_year' => $this->last_used_year,
            'currently_using' => $this->currently_using,
            'badge_label' => $this->badge_label,
            'badge_color' => $this->badge_color,
            'icon' => $this->icon,
            'featured' => $this->featured,
        ];
    }
}
