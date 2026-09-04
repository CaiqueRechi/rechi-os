<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalemUnlock extends Model
{
    protected $fillable = [
        'player_id',
        'unlock_type',
        'unlock_key',
        'metadata',
        'unlocked_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'unlocked_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<SalemPlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(SalemPlayer::class, 'player_id');
    }
}
