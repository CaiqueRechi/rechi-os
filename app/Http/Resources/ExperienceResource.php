<?php

namespace App\Http\Resources;

use App\Models\Experience;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Experience */
class ExperienceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'role' => $this->role,
            'company' => $this->company,
            'location' => $this->location,
            'employment_type' => $this->employment_type,
            'summary' => $this->summary,
            'achievements' => $this->achievements ?? [],
            'started_at' => (string) $this->started_at,
            'ended_at' => $this->ended_at ? (string) $this->ended_at : null,
            'current' => $this->current,
            'technologies' => $this->whenLoaded('skills', fn () => SkillResource::collection($this->skills)->resolve()),
        ];
    }
}
