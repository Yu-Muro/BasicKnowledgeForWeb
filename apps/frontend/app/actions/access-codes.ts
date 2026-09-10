'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type AccessCode = {
    id: string;
    code: string;
    eventName: string;
    validFrom: string;
    validTo: string;
};

type ActionResult =
    | { success: true; data: AccessCode[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function createAccessCodeAction(data: {
    code: string;
    eventName: string;
    validFrom: string;
    validTo: string;
}): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/access-codes';
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `auth_token=${authToken}`,
            },
            body: JSON.stringify(data),
        });
        logAction(
            'createAccessCodeAction',
            'POST',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? 'コードの作成に失敗しました',
            };
        }
        const snapshot = await fetchAccessCodesSnapshot(authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createAccessCodeAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: 'コードの作成に失敗しました' };
    }
}

export async function deleteAccessCodeAction(
    id: string,
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/access-codes/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: { Cookie: `auth_token=${authToken}` },
        });
        logAction(
            'deleteAccessCodeAction',
            'DELETE',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '削除に失敗しました',
            };
        }
        const snapshot = await fetchAccessCodesSnapshot(authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteAccessCodeAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchAccessCodesSnapshot(
    authToken: string,
): Promise<ActionResult> {
    const endpoint = '/api/access-codes';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: { Cookie: `auth_token=${authToken}` },
        });
        logAction(
            'fetchAccessCodesSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            res.status,
        );
        let body: unknown = null;
        try {
            body = await res.json();
        } catch {
            body = null;
        }
        if (!res.ok) {
            const errorBody = body as { error?: string } | null;
            return {
                success: false,
                error:
                    errorBody?.error ??
                    '最新のアクセスコード取得に失敗しました',
            };
        }
        const list = (body as { codes?: AccessCode[] } | null)?.codes;
        if (!Array.isArray(list)) {
            return {
                success: false,
                error: '最新のアクセスコード取得に失敗しました',
            };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchAccessCodesSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return {
            success: false,
            error: '最新のアクセスコード取得に失敗しました',
        };
    }
}
