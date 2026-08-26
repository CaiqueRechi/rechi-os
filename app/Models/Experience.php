<?php

namespace App\Models;

use Database\Factories\ExperienceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Experience extends Model
{
    /** @use HasFactory<ExperienceFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'role',
        'company',
        'summary',
        'started_at',
        'ended_at',
        'current',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'date',
            'ended_at' => 'date',
            'current' => 'boolean',
        ];
    }
}
