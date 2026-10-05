<?php

namespace App\Console\Commands;

use App\Enums\ScreenAccessLevel;
use App\Models\ScreenAccessPermission;
use App\Models\User;
use Illuminate\Console\Command;

class SetScreenAccess extends Command
{
    protected $signature = 'access:set
        {email : E-mail do usuário}
        {screen : Identificador da tela, por exemplo library ou salem}
        {level : none, read ou write}';

    protected $description = 'Define o nível de acesso de um usuário a uma tela';

    public function handle(): int
    {
        $user = User::query()->where('email', $this->argument('email'))->first();
        $level = ScreenAccessLevel::tryFrom((string) $this->argument('level'));
        $screenKey = trim((string) $this->argument('screen'));

        if (! $user) {
            $this->error('Usuário não encontrado.');

            return self::FAILURE;
        }

        if (! $level || $screenKey === '') {
            $this->error('Informe uma tela e um nível válido: none, read ou write.');

            return self::FAILURE;
        }

        ScreenAccessPermission::query()->updateOrCreate(
            ['user_id' => $user->id, 'screen_key' => $screenKey],
            ['access_level' => $level],
        );

        $this->info("Acesso {$level->value} aplicado em {$screenKey} para {$user->email}.");

        return self::SUCCESS;
    }
}
