<?php

namespace App\Services\Salem;

use App\Models\SalemGameSave;
use App\Models\SalemMarketTransaction;
use App\Models\SalemPlayer;
use App\Models\SalemPlayerItem;
use App\Models\SalemShopItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalemMarketService
{
    public function __construct(private SalemProgressionService $progression) {}

    /** @return list<array<string, mixed>> */
    public function catalogFor(SalemPlayer $player): array
    {
        $ownedByItem = $player->items()->pluck('quantity', 'shop_item_id');
        $catalog = [];

        $items = SalemShopItem::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        foreach ($items as $item) {
            $catalog[] = $this->serializeItem(
                $item,
                (int) ($ownedByItem[$item->id] ?? 0),
            );
        }

        return $catalog;
    }

    /** @return array{save: array<string, mixed>, item: array<string, mixed>, message: string} */
    public function trade(SalemPlayer $player, SalemShopItem $item, string $type, int $quantity): array
    {
        return DB::transaction(function () use ($player, $item, $type, $quantity): array {
            $lockedItem = SalemShopItem::query()->lockForUpdate()->findOrFail($item->id);

            if (! $lockedItem->is_active) {
                throw ValidationException::withMessages(['item_id' => 'Este item não está disponível.']);
            }

            $save = $this->progression->resolveSave($player);
            $save = SalemGameSave::query()->lockForUpdate()->findOrFail($save->id);
            $inventory = SalemPlayerItem::query()
                ->where('player_id', $player->id)
                ->where('shop_item_id', $lockedItem->id)
                ->lockForUpdate()
                ->first();
            $inventory ??= new SalemPlayerItem([
                'player_id' => $player->id,
                'shop_item_id' => $lockedItem->id,
                'quantity' => 0,
            ]);

            $price = $type === 'buy' ? $lockedItem->buy_price : $lockedItem->sell_price;

            if ($price === null) {
                throw ValidationException::withMessages(['item_id' => 'Esta operação não está disponível para o item.']);
            }

            $total = $price * $quantity;
            $balanceBefore = $save->cozy_points;

            if ($type === 'buy') {
                if ($balanceBefore < $total) {
                    throw ValidationException::withMessages(['item_id' => 'Cozy Points insuficientes para esta compra.']);
                }

                $nextQuantity = $inventory->quantity + $quantity;
                $balanceAfter = $balanceBefore - $total;
            } else {
                if ($inventory->quantity < $quantity) {
                    throw ValidationException::withMessages(['item_id' => 'Você não possui essa quantidade para vender.']);
                }

                $nextQuantity = $inventory->quantity - $quantity;
                $balanceAfter = $balanceBefore + $total;
            }

            $inventory->forceFill(['quantity' => $nextQuantity]);
            $inventory->save();
            $save->forceFill(['cozy_points' => $balanceAfter])->save();

            SalemMarketTransaction::query()->create([
                'player_id' => $player->id,
                'shop_item_id' => $lockedItem->id,
                'type' => $type,
                'quantity' => $quantity,
                'unit_price' => $price,
                'total_price' => $total,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
            ]);

            return [
                'save' => $this->progression->serializeSave($save->refresh()),
                'item' => $this->serializeItem($lockedItem, $inventory->quantity),
                'message' => $type === 'buy' ? 'Compra realizada.' : 'Venda realizada.',
            ];
        });
    }

    /** @return array<string, mixed> */
    protected function serializeItem(SalemShopItem $item, int $owned): array
    {
        return [
            'id' => $item->id,
            'key' => $item->item_key,
            'name' => $item->name,
            'description' => $item->description,
            'buy_price' => $item->buy_price,
            'sell_price' => $item->sell_price,
            'owned' => $owned,
            'metadata' => $item->metadata ?? [],
        ];
    }
}
