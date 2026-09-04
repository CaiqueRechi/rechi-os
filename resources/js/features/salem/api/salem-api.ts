import type { SalemAction, SalemActionResponse } from '@/types';

const actionEndpoint = '/salem/actions';

export async function recordSalemAction(
    action: SalemAction | 'dev_cozy_points',
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

function csrfToken(): string {
    const token = document
        .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
        ?.getAttribute('content');

    return token ?? '';
}
