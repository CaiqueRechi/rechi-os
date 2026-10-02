<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SalemPlayer extends Model
{
    protected $fillable = [
        'user_id',
        'visitor_key',
        'ip_hash',
        'first_seen_at',
        'last_seen_at',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'first_seen_at' => 'immutable_datetime',
            'last_seen_at' => 'immutable_datetime',
        ];
    }

    /** @return HasOne<SalemGameSave, $this> */
    public function gameSave(): HasOne
    {
        return $this->hasOne(SalemGameSave::class, 'player_id');
    }

    /** @return HasMany<SalemUnlock, $this> */
    public function unlocks(): HasMany
    {
        return $this->hasMany(SalemUnlock::class, 'player_id');
    }

    /** @return HasMany<SalemPlayerItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(SalemPlayerItem::class, 'player_id');
    }

    /** @return HasMany<SalemMarketTransaction, $this> */
    public function marketTransactions(): HasMany
    {
        return $this->hasMany(SalemMarketTransaction::class, 'player_id');
    }
}
