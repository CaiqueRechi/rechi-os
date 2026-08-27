<?php

namespace App\Models;

use Database\Factories\ProjectFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    /** @use HasFactory<ProjectFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'summary',
        'problem',
        'responsibilities',
        'technical_decisions',
        'architecture',
        'technologies',
        'results',
        'metrics',
        'demo_url',
        'repository_url',
        'status',
        'period',
        'featured',
        'sort_order',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'responsibilities' => 'array',
            'technical_decisions' => 'array',
            'architecture' => 'array',
            'technologies' => 'array',
            'results' => 'array',
            'metrics' => 'array',
            'featured' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    /** @return HasMany<ProjectImage, $this> */
    public function images(): HasMany
    {
        return $this->hasMany(ProjectImage::class)->orderBy('sort_order');
    }

    /** @return BelongsToMany<Skill, $this> */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class)
            ->withPivot(['context', 'sort_order'])
            ->orderByPivot('sort_order');
    }
}
