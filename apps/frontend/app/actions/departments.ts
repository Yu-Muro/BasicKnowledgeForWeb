'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type Department = { id: string; name: string };

type ActionResult =
    | { success: true; data: Department[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function createDepartmentAction(data: {
    name: string;
}): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/departments';
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
            'createDepartmentAction',
            'POST',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '登録に失敗しました',
            };
        }
        const snapshot = await fetchDepartmentsSnapshot(authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createDepartmentAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateDepartmentAction(
    id: string,
    data: { name?: string },
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/departments/${id}`;
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
            'updateDepartmentAction',
            'PUT',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '更新に失敗しました',
            };
        }
        const snapshot = await fetchDepartmentsSnapshot(authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateDepartmentAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteDepartmentAction(
    id: string,
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/departments/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
            },
        });
        logAction(
            'deleteDepartmentAction',
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
        const snapshot = await fetchDepartmentsSnapshot(authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteDepartmentAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchDepartmentsSnapshot(
    authToken: string,
): Promise<ActionResult> {
    const endpoint = '/api/departments';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
            },
        });
        logAction(
            'fetchDepartmentsSnapshot',
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
                error: errorBody?.error ?? '最新の部署一覧の取得に失敗しました',
            };
        }
        const list = (body as { departments?: Department[] } | null)
            ?.departments;
        if (!Array.isArray(list)) {
            return {
                success: false,
                error: '最新の部署一覧の取得に失敗しました',
            };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchDepartmentsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return {
            success: false,
            error: '最新の部署一覧の取得に失敗しました',
        };
    }
}
