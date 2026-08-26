<?php

namespace App\Models;

use Database\Factories\SocialLinkFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SocialLink extends Model
{
    /** @use HasFactory<SocialLinkFactory> */
    use HasFactory;

    protected $fillable = ['label', 'url', 'icon', 'public', 'sort_order'];

    protected function casts(): array
    {
        return ['public' => 'boolean'];
    }
}
