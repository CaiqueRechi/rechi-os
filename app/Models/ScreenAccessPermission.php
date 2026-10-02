<?php

namespace App\Models;

use App\Enums\ScreenAccessLevel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScreenAccessPermission extends Model
{
    protected $fillable = [
        'user_id',
        'screen_key',
        'access_level',
    ];

    protected function casts(): array
    {
        return [
            'access_level' => ScreenAccessLevel::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
