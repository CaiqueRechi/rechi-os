<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalemMarketTransaction extends Model
{
    protected $fillable = [
        'player_id',
        'shop_item_id',
        'type',
        'quantity',
        'unit_price',
        'total_price',
        'balance_before',
        'balance_after',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'integer',
            'total_price' => 'integer',
            'balance_before' => 'integer',
            'balance_after' => 'integer',
        ];
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
