'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { buildBackendUrl, fetchFromBackend } from '../lib/backendFetch';

export async function logoutAction(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const hadAuthToken = token != null;
    if (token) {
        const response = await fetchFromBackend('/api/auth/logout', {
            method: 'POST',
            headers: {
                Cookie: `auth_token=${token}`,
                Origin: new URL(buildBackendUrl('/api/auth/logout')).origin,
            },
            cache: 'no-store',
        });
        if (!response.ok)
            throw new Error('ログアウトに失敗しました。再試行してください');
    }
    cookieStore.delete('auth_token');
    cookieStore.delete('access_token');
    redirect(hadAuthToken ? '/login' : '/access');
}
