<?php

namespace App\Http\Resources;

use App\Models\Project;
use App\Models\ProjectImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Project */
class ProjectResource extends JsonResource
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
            'problem' => $this->problem,
            'responsibilities' => $this->responsibilities,
            'technical_decisions' => $this->technical_decisions,
            'architecture' => $this->architecture,
            'technologies' => $this->technologies,
            'technology_badges' => $this->whenLoaded('skills', fn () => SkillResource::collection($this->skills)->resolve()),
            'results' => $this->results,
            'metrics' => $this->metrics,
            'demo_url' => $this->demo_url,
            'repository_url' => $this->repository_url,
            'status' => $this->status,
            'period' => $this->period,
            'featured' => $this->featured,
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn (ProjectImage $image) => [
                'path' => $image->path,
                'alt_text' => $image->alt_text,
            ])),
        ];
    }
}
