<?php

namespace App\Http\Resources;

use App\Models\Profile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Profile */
class ProfileResource extends JsonResource
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
            'headline' => $this->headline,
            'location' => $this->location,
            'summary' => $this->summary,
            'availability' => $this->availability,
            'avatar_path' => $this->avatar_path,
            'resume_url' => $this->resume_url,
            'contact_email' => $this->contact_email,
        ];
    }
}
