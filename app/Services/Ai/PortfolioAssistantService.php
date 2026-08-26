<?php

namespace App\Services\Ai;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\SkillCategory;
use App\Services\PublicPortfolioRepository;
use Illuminate\Support\Str;

class PortfolioAssistantService
{
    public function __construct(
        private readonly AiGateway $gateway,
        private readonly PublicPortfolioRepository $portfolio,
    ) {}

    public function answer(string $question, string $sessionId, ?string $ip): string
    {
        $question = strip_tags(Str::limit($question, 1200, ''));

        $conversation = AiConversation::firstOrCreate(
            ['session_hash' => hash('sha256', $sessionId)],
            ['opaque_id' => (string) Str::uuid(), 'ip_hash' => $ip ? hash('sha256', $ip) : null],
        );

        AiMessage::create([
            'ai_conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => $question,
        ]);

        $profile = $this->portfolio->profile();
        $projects = $this->portfolio->projects()->pluck('name')->implode(', ');
        $skills = $this->portfolio->skills()
            ->flatMap(fn (SkillCategory $category) => $category->skills->pluck('name'))
            ->implode(', ');

        $context = "Use only this public portfolio context. Name: {$profile?->name}. Headline: {$profile?->headline}. Summary: {$profile?->summary}. Projects: {$projects}. Skills: {$skills}.";

        try {
            $answer = $this->gateway->respond([
                ['role' => 'system', 'content' => $context],
                ['role' => 'user', 'content' => $question],
            ], $this->tools());
        } catch (\Throwable) {
            $answer = 'Estou sem conexao com o assistente agora, mas posso responder com os dados publicos do portfolio: Caique Rechi trabalha com PHP, Laravel, APIs, pagamentos, integracoes e sistemas empresariais.';
        }

        AiMessage::create([
            'ai_conversation_id' => $conversation->id,
            'role' => 'assistant',
            'content' => strip_tags($answer),
        ]);

        return strip_tags($answer);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function tools(): array
    {
        $emptyObject = ['type' => 'object', 'properties' => [], 'additionalProperties' => false];

        return [
            ['type' => 'function', 'name' => 'get_profile', 'description' => 'Read public profile.', 'parameters' => $emptyObject, 'strict' => true],
            ['type' => 'function', 'name' => 'list_projects', 'description' => 'Read public projects.', 'parameters' => $emptyObject, 'strict' => true],
            ['type' => 'function', 'name' => 'list_experiences', 'description' => 'Read public experiences.', 'parameters' => $emptyObject, 'strict' => true],
            ['type' => 'function', 'name' => 'list_skills', 'description' => 'Read public skills.', 'parameters' => $emptyObject, 'strict' => true],
            ['type' => 'function', 'name' => 'get_contact_options', 'description' => 'Read public contact options.', 'parameters' => $emptyObject, 'strict' => true],
            [
                'type' => 'function',
                'name' => 'get_project',
                'description' => 'Read one public project by slug.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => ['slug' => ['type' => 'string', 'maxLength' => 80]],
                    'required' => ['slug'],
                    'additionalProperties' => false,
                ],
                'strict' => true,
            ],
        ];
    }
}
