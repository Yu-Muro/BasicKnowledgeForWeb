import { cookies } from 'next/headers';
import { fetchFromBackend } from './backendFetch';

export type AuthPayload = {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId?: string | null;
    exp?: number;
};
export type AccessPayload = { event_id: string; exp?: number };

const textDecoder = new TextDecoder();

function normalizeBase64(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    return normalized.padEnd(normalized.length + padding, '=');
}

export function decodeJwtPayload<T>(token: string): T | null {
    try {
        const segment = token.split('.')[1];
        if (!segment) return null;
        const base64 = normalizeBase64(segment);
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const json = textDecoder.decode(bytes);
        return JSON.parse(json) as T;
    } catch {
        return null;
    }
}

function isTokenExpired(payload: { exp?: number } | null): boolean {
    if (!payload?.exp) {
        return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
}

export type ResolvedAuth = {
    eventId: string | null;
    authToken: string | null;
    accessToken: string | null;
    role: string;
    user?: AuthPayload | null;
};

export async function resolveAuth(
    searchParamEventId?: string,
): Promise<ResolvedAuth> {
    const cookieStore = await cookies();
    const rawAuthToken = cookieStore.get('auth_token')?.value ?? null;
    const rawAccessToken = cookieStore.get('access_token')?.value ?? null;

    const accessPayload = rawAccessToken
        ? decodeJwtPayload<AccessPayload>(rawAccessToken)
        : null;

    const validAccessPayload =
        accessPayload && !isTokenExpired(accessPayload) ? accessPayload : null;

    let currentUser: AuthPayload | null = null;
    if (rawAuthToken) {
        try {
            const res = await fetchFromBackend('/api/auth/me', {
                headers: { Cookie: `auth_token=${rawAuthToken}` },
                cache: 'no-store',
            });
            if (res.ok) currentUser = (await res.json()) as AuthPayload;
        } catch {
            currentUser = null;
        }
    }
    const authToken = currentUser ? rawAuthToken : null;
    const accessToken = validAccessPayload ? rawAccessToken : null;

    const role = currentUser?.role ?? 'viewer';
    const isPrivileged = ['admin', 'user'].includes(role);

    const eventId = isPrivileged
        ? (searchParamEventId ?? null)
        : (validAccessPayload?.event_id ?? null);

    return { eventId, authToken, accessToken, role, user: currentUser };
}

export function buildContentFetchHeaders(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): HeadersInit {
    const isPrivileged = ['admin', 'user'].includes(role);
    const headers: HeadersInit = {
        'x-event-id': eventId,
    };

    if (isPrivileged) {
        if (authToken) {
            headers.Cookie = `auth_token=${authToken}`;
        }
    } else if (accessToken) {
        headers.Cookie = `access_token=${accessToken}`;
    }

    return headers;
}
