<?php

namespace Tests\Feature;

use App\Jobs\SendContactMessageNotification;
use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ContactMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_stores_contact_messages_and_dispatches_a_queue_job(): void
    {
        Queue::fake();

        $this->post('/contact', [
            'name' => 'Client',
            'email' => 'client@example.com',
            'subject' => 'Laravel project',
            'message' => 'I want to talk about a robust Laravel integration.',
            'consent' => '1',
        ])->assertRedirect();

        $this->assertSame(1, ContactMessage::count());
        Queue::assertPushed(SendContactMessageNotification::class);
    }

    public function test_rejects_the_honeypot_field(): void
    {
        $this->post('/contact', [
            'name' => 'Bot',
            'email' => 'bot@example.com',
            'subject' => 'Spam',
            'message' => 'This is a message long enough to pass validation.',
            'consent' => '1',
            'website' => 'https://spam.test',
        ])->assertSessionHasErrors('website');
    }
}
