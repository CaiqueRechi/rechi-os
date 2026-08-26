<?php

namespace App\Jobs;

use App\Models\ContactMessage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class SendContactMessageNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ContactMessage $message) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info('Portfolio contact message received', [
            'message_id' => $this->message->id,
            'subject' => $this->message->subject,
            'status' => $this->message->status,
        ]);
    }
}
