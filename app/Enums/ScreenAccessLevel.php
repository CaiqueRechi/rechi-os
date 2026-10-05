<?php

namespace App\Enums;

enum ScreenAccessLevel: string
{
    case None = 'none';
    case Read = 'read';
    case Write = 'write';

    public function rank(): int
    {
        return match ($this) {
            self::None => 0,
            self::Read => 1,
            self::Write => 2,
        };
    }

    public function allows(self $required): bool
    {
        return $this->rank() >= $required->rank();
    }
}
