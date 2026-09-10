'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type ActionResult = { success: true } | { success: false; error: string };
type UserEntry = {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
};
type UserRoleResult =
    | { success: true; data: UserEntry[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function changePasswordAction(data: {
    currentPassword: string;
    newPassword: string;
}): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/auth/password';
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `auth_token=${authToken}`,
            },
            body: JSON.stringify(data),
        });
        logAction(
            'changePasswordAction',
            'PUT',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? 'パスワードの変更に失敗しました',
            };
        }
        return { success: true };
    } catch (err) {
        logActionError(
            'changePasswordAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: 'パスワードの変更に失敗しました' };
    }
}

export async function updateUserRoleAction(
    userId: string,
    role: 'user' | 'admin',
): Promise<UserRoleResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/users/${userId}/role`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `auth_token=${authToken}`,
            },
            body: JSON.stringify({ role }),
        });
        logAction(
            'updateUserRoleAction',
            'PUT',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? 'ロールの変更に失敗しました',
            };
        }
        const snapshot = await fetchUsersSnapshot(authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateUserRoleAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: 'ロールの変更に失敗しました' };
    }
}

async function fetchUsersSnapshot(authToken: string): Promise<UserRoleResult> {
    const endpoint = '/api/users';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: { Cookie: `auth_token=${authToken}` },
        });
        logAction(
            'fetchUsersSnapshot',
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
                    errorBody?.error ?? '最新ユーザー一覧の取得に失敗しました',
            };
        }
        const list = (body as { users?: UserEntry[] } | null)?.users;
        if (!Array.isArray(list)) {
            return {
                success: false,
                error: '最新ユーザー一覧の取得に失敗しました',
            };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchUsersSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return {
            success: false,
            error: '最新ユーザー一覧の取得に失敗しました',
        };
    }
}
