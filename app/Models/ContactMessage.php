<?php

namespace App\Models;

use Database\Factories\ContactMessageFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    /** @use HasFactory<ContactMessageFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'subject',
        'message',
        'consent',
        'status',
        'ip_hash',
        'user_agent',
        'handled_at',
    ];

    protected function casts(): array
    {
        return [
            'consent' => 'boolean',
            'handled_at' => 'datetime',
        ];
    }
}
