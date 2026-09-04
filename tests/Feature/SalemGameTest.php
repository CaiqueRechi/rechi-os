<?php

namespace Tests\Feature;

use App\Models\SalemGameSave;
use App\Models\SalemPlayer;
use App\Services\Salem\SalemPlayerIdentityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpFoundation\Cookie;
use Tests\TestCase;

class SalemGameTest extends TestCase
{
    use RefreshDatabase;

    public function test_salem_route_is_public_and_creates_anonymous_progress(): void
    {
        $response = $this->get('/salem');

        $response->assertOk();

        $this->assertDatabaseCount('salem_players', 1);
        $this->assertDatabaseCount('salem_game_saves', 1);
        $this->assertNotNull($this->salemCookie($response->headers->getCookies()));
    }

    public function test_returning_visitor_keeps_the_same_save(): void
    {
        $response = $this->get('/salem');
        $cookie = $this->salemCookie($response->headers->getCookies());

        $this->assertNotNull($cookie);
        $visitorKey = SalemPlayer::query()->sole()->visitor_key;

        $this->withCookie(SalemPlayerIdentityService::VISITOR_COOKIE, $visitorKey)
            ->withCredentials()
            ->postJson('/salem/actions', ['action' => 'program'])
            ->assertOk()
            ->assertJsonPath('accepted', true)
            ->assertJsonPath('reward', 18);

        $this->withCookie(SalemPlayerIdentityService::VISITOR_COOKIE, $visitorKey)
            ->get('/salem')
            ->assertOk();

        $this->assertDatabaseCount('salem_players', 1);
        $this->assertDatabaseHas('salem_game_saves', [
            'cozy_points' => 18,
            'xp' => 18,
            'pet_state' => 'program',
        ]);
    }

    public function test_separate_visitors_do_not_share_saves(): void
    {
        $this->get('/salem')->assertOk();
        $this->get('/salem')->assertOk();

        $this->assertDatabaseCount('salem_players', 2);
        $this->assertDatabaseCount('salem_game_saves', 2);
    }

    public function test_client_cannot_inject_arbitrary_progress(): void
    {
        $this->postJson('/salem/actions', [
            'action' => 'program',
            'cozy_points' => 999999999,
        ])
            ->assertOk()
            ->assertJsonPath('reward', 18)
            ->assertJsonPath('save.cozy_points', 18);

        $this->assertDatabaseMissing('salem_game_saves', [
            'cozy_points' => 999999999,
        ]);
    }

    public function test_progression_action_validation_and_cooldowns(): void
    {
        $response = $this->get('/salem');
        $cookie = $this->salemCookie($response->headers->getCookies());

        $this->assertNotNull($cookie);
        $visitorKey = SalemPlayer::query()->sole()->visitor_key;

        $this->withCookie(SalemPlayerIdentityService::VISITOR_COOKIE, $visitorKey)
            ->withCredentials()
            ->postJson('/salem/actions', ['action' => 'program'])
            ->assertOk()
            ->assertJsonPath('accepted', true);

        $this->withCookie(SalemPlayerIdentityService::VISITOR_COOKIE, $visitorKey)
            ->withCredentials()
            ->postJson('/salem/actions', ['action' => 'program'])
            ->assertOk()
            ->assertJsonPath('accepted', false)
            ->assertJsonPath('reward', 0)
            ->assertJsonPath('save.cozy_points', 18);

        $this->withCookie(SalemPlayerIdentityService::VISITOR_COOKIE, $visitorKey)
            ->withCredentials()
            ->postJson('/salem/actions', ['action' => 'teleport'])
            ->assertUnprocessable();
    }

    public function test_models_expose_salem_relationships(): void
    {
        $player = SalemPlayer::query()->create([
            'visitor_key' => '9f241a89-cb3b-4c1b-9f1f-f3b9d5c19c5d',
            'first_seen_at' => now(),
            'last_seen_at' => now(),
        ]);

        SalemGameSave::query()->create([
            'player_id' => $player->id,
            'level' => 1,
            'xp' => 0,
            'cozy_points' => 0,
            'current_biome' => 'main',
            'pet_state' => 'idle',
        ]);

        $player->unlocks()->create([
            'unlock_type' => 'biome',
            'unlock_key' => 'misty_rock_isle',
            'unlocked_at' => now(),
        ]);

        $this->assertTrue($player->gameSave()->exists());
        $this->assertSame('misty_rock_isle', $player->unlocks()->first()?->unlock_key);
    }

    /** @param list<Cookie> $cookies */
    private function salemCookie(array $cookies): ?Cookie
    {
        foreach ($cookies as $cookie) {
            if ($cookie->getName() === SalemPlayerIdentityService::VISITOR_COOKIE) {
                return $cookie;
            }
        }

        return null;
    }
}
