<?php

namespace App\Models;

use Database\Factories\SkillFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Skill extends Model
{
    /** @use HasFactory<SkillFactory> */
    use HasFactory;

    protected $fillable = [
        'skill_category_id',
        'name',
        'slug',
        'summary',
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
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'years_experience' => 'decimal:1',
            'proficiency_percent' => 'integer',
            'first_used_year' => 'integer',
            'last_used_year' => 'integer',
            'currently_using' => 'boolean',
            'featured' => 'boolean',
        ];
    }

    /** @return BelongsTo<SkillCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(SkillCategory::class, 'skill_category_id');
    }

    /** @return BelongsToMany<Project, $this> */
    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class)
            ->withPivot(['context', 'sort_order']);
    }

    /** @return BelongsToMany<Experience, $this> */
    public function experiences(): BelongsToMany
    {
        return $this->belongsToMany(Experience::class)
            ->withPivot(['context', 'sort_order']);
    }
}
