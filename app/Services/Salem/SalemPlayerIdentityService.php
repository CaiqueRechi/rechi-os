<?php

namespace App\Services\Salem;

use App\Models\SalemPlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;

class SalemPlayerIdentityService
{
    public const VISITOR_COOKIE = 'salem_visitor';

    public function resolvePlayer(Request $request): SalemPlayer
    {
        $visitorKey = $this->validVisitorKey($request) ?? (string) Str::uuid();
        $now = now();

        Cookie::queue(Cookie::make(
            self::VISITOR_COOKIE,
            $visitorKey,
            60 * 24 * 365 * 2,
            null,
            null,
            $request->isSecure(),
            true,
            false,
            'Lax',
        ));

        $player = SalemPlayer::query()->firstOrCreate(
            ['visitor_key' => $visitorKey],
            [
                'ip_hash' => $this->ipHash($request),
                'first_seen_at' => $now,
                'last_seen_at' => $now,
            ],
        );

        $player->forceFill(['last_seen_at' => $now])->save();

        return $player;
    }

    protected function validVisitorKey(Request $request): ?string
    {
        $visitorKey = $request->cookies->get(self::VISITOR_COOKIE);

        if (! is_string($visitorKey) || ! Str::isUuid($visitorKey)) {
            return null;
        }

        return $visitorKey;
    }

    protected function ipHash(Request $request): ?string
    {
        $ipAddress = $request->ip();

        if (! is_string($ipAddress) || $ipAddress === '') {
            return null;
        }

        return hash_hmac('sha256', $ipAddress, (string) config('app.key'));
    }
}
