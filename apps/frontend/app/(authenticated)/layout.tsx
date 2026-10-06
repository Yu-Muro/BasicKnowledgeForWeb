import { AuthProvider } from '@frontend/app/(authenticated)/auth-context';
import { logoutAction } from '@frontend/app/actions/auth';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    type AccessPayload,
    decodeJwtPayload,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import { AuthHeader } from '@frontend/components/AuthHeader';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

type AccessCode = { id: string; eventName: string };

async function fetchAccessCodes(authToken: string): Promise<AccessCode[]> {
    try {
        const res = await fetchFromBackend('/api/events', {
            headers: { Cookie: `auth_token=${authToken}` },
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { events: AccessCode[] };
        return data.events ?? [];
    } catch {
        return [];
    }
}

async function fetchAccessCode(
    accessToken: string,
    eventId: string,
): Promise<string | null> {
    try {
        const res = await fetchFromBackend(`/api/access-codes/${eventId}`, {
            headers: {
                Cookie: `access_token=${accessToken}`,
                'x-event-id': eventId,
            },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { code: AccessCode };
        return data.code?.eventName ?? null;
    } catch {
        return null;
    }
}

export default async function AuthenticatedLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { authToken, accessToken, role, user } = await resolveAuth();

    const accessPayload = accessToken
        ? decodeJwtPayload<AccessPayload>(accessToken)
        : null;

    const userName = user?.name ?? null;
    const userEventId = accessPayload?.event_id ?? null;

    const isPrivileged = ['admin', 'user'].includes(role);
    const accessCodes: AccessCode[] =
        isPrivileged && authToken ? await fetchAccessCodes(authToken) : [];
    const userEventName: string | null =
        !isPrivileged && accessToken && userEventId
            ? await fetchAccessCode(accessToken, userEventId)
            : null;

    return (
        <AuthProvider value={{ role, userEventId }}>
            <div className='min-h-screen bg-background'>
                <Suspense fallback={null}>
                    <AuthHeader
                        role={role}
                        userName={userName}
                        userEventId={userEventId}
                        userEventName={userEventName}
                        accessCodes={accessCodes}
                        logoutAction={logoutAction}
                    />
                </Suspense>
                <main className='mx-auto max-w-5xl px-4 py-8 sm:px-6'>
                    {children}
                </main>
            </div>
        </AuthProvider>
    );
}
