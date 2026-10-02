<?php

namespace App\Models;

use App\Enums\ScreenAccessLevel;
// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property bool $is_admin
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'is_admin'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /** @return HasMany<ScreenAccessPermission, $this> */
    public function screenAccessPermissions(): HasMany
    {
        return $this->hasMany(ScreenAccessPermission::class);
    }

    /** @return HasOne<SalemPlayer, $this> */
    public function salemPlayer(): HasOne
    {
        return $this->hasOne(SalemPlayer::class);
    }

    public function screenAccessLevel(string $screenKey): ScreenAccessLevel
    {
        $permission = $this->screenAccessPermissions()
            ->where('screen_key', $screenKey)
            ->first();

        if (! $permission) {
            return ScreenAccessLevel::None;
        }

        $level = $permission->getAttribute('access_level');

        if ($level instanceof ScreenAccessLevel) {
            return $level;
        }

        return ScreenAccessLevel::tryFrom((string) $level) ?? ScreenAccessLevel::None;
    }

    public function hasScreenAccess(string $screenKey, ScreenAccessLevel $required): bool
    {
        return $this->screenAccessLevel($screenKey)->allows($required);
    }
}
