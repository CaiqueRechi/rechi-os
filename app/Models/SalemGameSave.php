<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalemGameSave extends Model
{
    protected $fillable = [
        'player_id',
        'level',
        'xp',
        'cozy_points',
        'current_biome',
        'pet_state',
        'state_payload',
        'save_version',
        'last_progress_at',
    ];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
            'xp' => 'integer',
            'cozy_points' => 'integer',
            'state_payload' => 'array',
            'save_version' => 'integer',
            'last_progress_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<SalemPlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(SalemPlayer::class, 'player_id');
    }
}
