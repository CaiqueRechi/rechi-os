<?php

namespace App\Services\Salem;

use App\Models\SalemPlayer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;

class SalemPlayerIdentityService
{
    public const VISITOR_COOKIE = 'salem_visitor';

    public function resolvePlayer(Request $request): SalemPlayer
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        $existingPlayer = $user->salemPlayer()->first();

        if ($existingPlayer instanceof SalemPlayer) {
            $existingPlayer->forceFill(['last_seen_at' => now()])->save();

            return $existingPlayer;
        }

        $now = now();
        $legacyPlayer = $this->legacyPlayer($request);

        Cookie::queue(Cookie::forget(self::VISITOR_COOKIE));

        if ($legacyPlayer instanceof SalemPlayer) {
            $legacyPlayer->forceFill([
                'user_id' => $user->id,
                'last_seen_at' => $now,
            ])->save();

            return $legacyPlayer;
        }

        return SalemPlayer::query()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'visitor_key' => (string) Str::uuid(),
                'first_seen_at' => $now,
                'last_seen_at' => $now,
            ],
        );
    }

    protected function legacyPlayer(Request $request): ?SalemPlayer
    {
        $visitorKey = $request->cookies->get(self::VISITOR_COOKIE);

        if (! is_string($visitorKey) || ! Str::isUuid($visitorKey)) {
            return null;
        }

        return SalemPlayer::query()
            ->whereNull('user_id')
            ->where('visitor_key', $visitorKey)
            ->first();
    }
}
