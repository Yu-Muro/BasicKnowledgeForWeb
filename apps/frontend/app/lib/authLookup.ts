import { fetchFromBackend } from './backendFetch';
import type { AuthPayload } from './serverAuth';

export class AuthLookupError extends Error {
    constructor(readonly status: 403 | 503 = 503) {
        super(
            status === 403
                ? '所属部署などの利用条件を確認できません。管理者にご確認ください。'
                : '認証情報を確認できませんでした。時間をおいて再試行してください。',
        );
        this.name = 'AuthLookupError';
    }
}

export async function fetchCurrentUser(
    token: string,
): Promise<AuthPayload | null> {
    try {
        const response = await fetchFromBackend('/api/auth/me', {
            headers: { Cookie: `auth_token=${token}` },
            cache: 'no-store',
        });
        if (response.status === 401) return null;
        if (response.status === 403) throw new AuthLookupError(403);
        if (!response.ok) throw new AuthLookupError();
        const user = (await response.json()) as AuthPayload;
        if (
            !user ||
            typeof user.id !== 'string' ||
            !['admin', 'user'].includes(user.role)
        )
            throw new AuthLookupError();
        return user;
    } catch (error) {
        if (error instanceof AuthLookupError) throw error;
        throw new AuthLookupError();
    }
}
