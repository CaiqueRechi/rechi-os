<?php

namespace App\Services;

use App\Jobs\SendContactMessageNotification;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ContactMessageService
{
    /**
     * @param  array{name:string,email:string,subject:string,message:string,consent:bool}  $data
     */
    public function store(array $data, Request $request): ContactMessage
    {
        $message = ContactMessage::create([
            ...$data,
            'ip_hash' => $request->ip() ? Hash::make($request->ip()) : null,
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
        ]);

        SendContactMessageNotification::dispatch($message);

        return $message;
    }
}
