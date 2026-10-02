<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalemShopItem extends Model
{
    protected $fillable = [
        'item_key',
        'name',
        'description',
        'buy_price',
        'sell_price',
        'is_active',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'buy_price' => 'integer',
            'sell_price' => 'integer',
            'is_active' => 'boolean',
            'metadata' => 'array',
        ];
    }

    /** @return HasMany<SalemPlayerItem, $this> */
    public function playerItems(): HasMany
    {
        return $this->hasMany(SalemPlayerItem::class, 'shop_item_id');
    }
}
