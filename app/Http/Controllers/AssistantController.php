<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssistantQuestionRequest;
use App\Services\Ai\PortfolioAssistantService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssistantController extends Controller
{
    public function __invoke(AssistantQuestionRequest $request, PortfolioAssistantService $assistant): StreamedResponse
    {
        $answer = $assistant->answer(
            (string) $request->validated('question'),
            $request->session()->getId(),
            $request->ip(),
        );

        return response()->stream(function () use ($answer): void {
            foreach (str_split($answer, 120) as $chunk) {
                echo 'data: '.json_encode(['chunk' => $chunk], JSON_THROW_ON_ERROR)."\n\n";
                ob_flush();
                flush();
            }

            echo "event: done\ndata: {}\n\n";
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
