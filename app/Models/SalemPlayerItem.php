<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalemPlayerItem extends Model
{
    protected $fillable = [
        'player_id',
        'shop_item_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    /** @return BelongsTo<SalemPlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(SalemPlayer::class, 'player_id');
    }

    /** @return BelongsTo<SalemShopItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(SalemShopItem::class, 'shop_item_id');
    }
}
