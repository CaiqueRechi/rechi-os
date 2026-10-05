<?php

namespace App\Console\Commands;

use App\Enums\ScreenAccessLevel;
use App\Models\ScreenAccessPermission;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

#[Signature('portfolio:create-admin {email} {--name=Caique Rechi}')]
#[Description('Create the first protected Rechi OS administrator')]
class CreateAdminUser extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $name = (string) $this->option('name');
        $password = (string) $this->secret('Admin password');

        $validator = Validator::make([
            'email' => $email,
            'name' => $name,
            'password' => $password,
        ], [
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:12'],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'is_admin' => true,
        ]);

        $user->forceFill([
            'email_verified_at' => now(),
        ])->save();

        foreach (['library', 'salem'] as $screenKey) {
            ScreenAccessPermission::query()->create([
                'user_id' => $user->id,
                'screen_key' => $screenKey,
                'access_level' => ScreenAccessLevel::Write,
            ]);
        }

        $this->info('Admin user created.');

        return self::SUCCESS;
    }
}
