<?php

namespace App\Services\Ai;

interface AiGateway
{
    /**
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<int, array<string, mixed>>  $tools
     */
    public function respond(array $messages, array $tools): string;
}
