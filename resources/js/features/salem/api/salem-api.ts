import type {
    SalemAction,
    SalemActionResponse,
    SalemMarketResponse,
} from '@/types';

const actionEndpoint = '/salem/actions';

export async function recordSalemAction(
    action: SalemAction,
): Promise<SalemActionResponse> {
    const response = await fetch(actionEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify({ action }),
    });

    if (!response.ok) {
        throw new Error(`Salem action failed with ${response.status}`);
    }

    return response.json() as Promise<SalemActionResponse>;
}

export async function tradeSalemItem(
    itemId: number,
    action: 'buy' | 'sell',
    quantity = 1,
): Promise<SalemMarketResponse> {
    const response = await fetch('/salem/market', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify({ item_id: itemId, action, quantity }),
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
            message?: string;
            errors?: Record<string, string[]>;
        } | null;
        const validationMessage = payload?.errors
            ? Object.values(payload.errors).flat()[0]
            : null;

        throw new Error(
            validationMessage ?? payload?.message ?? 'A negociação falhou.',
        );
    }

    return response.json() as Promise<SalemMarketResponse>;
}

function csrfToken(): string {
    const token = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content');

    return token ?? '';
}
