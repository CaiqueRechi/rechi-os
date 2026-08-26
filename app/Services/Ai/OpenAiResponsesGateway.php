<?php

namespace App\Services\Ai;

use RuntimeException;

class OpenAiResponsesGateway implements AiGateway
{
    public function respond(array $messages, array $tools): string
    {
        if (! config('services.openai.key')) {
            throw new RuntimeException('OpenAI API key is not configured.');
        }

        $client = \OpenAI::client((string) config('services.openai.key'));
        $response = $client->responses()->create([
            'model' => config('services.openai.model'),
            'input' => $messages,
            'tools' => $tools,
            'max_output_tokens' => config('services.openai.max_output_tokens', 600),
        ]);

        return (string) ($response->outputText ?? '');
    }
}
