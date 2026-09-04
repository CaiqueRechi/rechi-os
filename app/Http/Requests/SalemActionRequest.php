<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalemActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'action' => ['required', 'string', Rule::in([
                'idle',
                'walk',
                'sit',
                'sleep',
                'inspect',
                'program',
                'dev_cozy_points',
            ])],
        ];
    }
}
