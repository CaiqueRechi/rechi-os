<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalemMarketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'item_id' => ['required', 'integer', 'exists:salem_shop_items,id'],
            'action' => ['required', 'string', Rule::in(['buy', 'sell'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ];
    }
}
