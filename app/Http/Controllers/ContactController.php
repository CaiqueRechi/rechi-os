<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreContactMessageRequest;
use App\Services\ContactMessageService;
use Illuminate\Http\RedirectResponse;

class ContactController extends Controller
{
    public function store(StoreContactMessageRequest $request, ContactMessageService $service): RedirectResponse
    {
        $validated = $request->validated();

        $service->store([
            'name' => (string) $validated['name'],
            'email' => (string) $validated['email'],
            'subject' => (string) $validated['subject'],
            'message' => (string) $validated['message'],
            'consent' => (bool) $validated['consent'],
        ], $request);

        return back()->with('success', 'Mensagem recebida. Obrigado pelo contato.');
    }
}
