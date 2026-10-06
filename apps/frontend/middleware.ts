import { verify } from 'hono/jwt';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchFromBackend } from './app/lib/backendFetch';

// JWT_SECRET は Edge Runtime では process.env から取得
const JWT_SECRET = process.env.JWT_SECRET ?? '';

type AuthPayload = { id: string; role: string };
type AccessPayload = { event_id: string; exp: number };

function debugLog(message: string, details: Record<string, unknown> = {}) {
    console.log(`[middleware] ${message}`, details);
}

async function verifyToken<T>(token: string): Promise<T | null> {
    try {
        const payload = await verify(token, JWT_SECRET, 'HS256');
        return payload as T;
    } catch {
        debugLog('token verification failed', { tokenPresent: !!token });
        return null;
    }
}

async function verifyAuthToken(token: string): Promise<AuthPayload | null> {
    try {
        const res = await fetchFromBackend('/api/auth/me', {
            headers: { Cookie: `auth_token=${token}` },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        return (await res.json()) as AuthPayload;
    } catch {
        return null;
    }
}

// コンテンツページ: access_token または auth_token(admin) が必要
const CONTENT_PATHS = [
    '/',
    '/timetable',
    '/rooms',
    '/events',
    '/shop',
    '/others',
    '/search',
];

// 管理者ダッシュボード（要ログイン）
const USER_AUTH_PATHS = ['/dashboard'];

// 管理者専用ルート
const ADMIN_PATHS = ['/admin'];

// 公開ページ（認証不要）
const PUBLIC_PATHS = ['/login', '/register', '/access'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const authToken = request.cookies.get('auth_token')?.value;
    const accessToken = request.cookies.get('access_token')?.value;

    if (pathname.startsWith('/login')) {
        if (authToken) {
            const auth = await verifyAuthToken(authToken);
            if (auth?.role === 'admin') {
                debugLog('redirecting /login -> /dashboard (admin token)', {
                    role: auth.role,
                });
                return NextResponse.redirect(
                    new URL('/dashboard', request.url),
                );
            }
            debugLog('auth_token present on /login but not admin', {
                hasAuth: true,
                verified: Boolean(auth),
                role: auth?.role ?? null,
            });
        }
        return NextResponse.next();
    }

    if (pathname.startsWith('/access')) {
        if (authToken) {
            const auth = await verifyAuthToken(authToken);
            if (auth?.role === 'admin') {
                debugLog('redirecting /access -> / (admin token)', {
                    role: auth.role,
                });
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
        if (accessToken) {
            const access = await verifyToken<AccessPayload>(accessToken);
            if (access) {
                debugLog('redirecting /access -> / (access token)', {});
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
        debugLog('staying on /access (no valid token)', {
            hasAuthToken: Boolean(authToken),
            hasAccessToken: Boolean(accessToken),
        });
        return NextResponse.next();
    }

    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // --- admin/* 保護 ---
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
        if (!authToken) {
            debugLog('redirect:/login missing auth_token', { pathname });
            return NextResponse.redirect(new URL('/login', request.url));
        }
        const auth = await verifyAuthToken(authToken);
        if (auth?.role !== 'admin') {
            debugLog('redirect:/login invalid admin token', {
                pathname,
                hasAuthToken: true,
                verified: Boolean(auth),
                role: auth?.role ?? null,
            });
            return NextResponse.redirect(new URL('/login', request.url));
        }
        debugLog('allow admin route', { pathname, role: auth.role });
        return NextResponse.next();
    }

    // --- /dashboard 保護 ---
    if (USER_AUTH_PATHS.some((p) => pathname.startsWith(p))) {
        if (!authToken) {
            debugLog('redirect:/login dashboard without auth_token', {
                pathname,
            });
            return NextResponse.redirect(new URL('/login', request.url));
        }
        const auth = await verifyAuthToken(authToken);
        if (auth?.role !== 'admin') {
            debugLog('redirect:/login dashboard auth failed', {
                pathname,
                hasAuthToken: true,
                verified: Boolean(auth),
                role: auth?.role ?? null,
            });
            return NextResponse.redirect(new URL('/login', request.url));
        }
        debugLog('allow dashboard', { role: auth.role });
        return NextResponse.next();
    }

    // --- コンテンツページ保護 ---
    if (
        CONTENT_PATHS.some(
            (p) => pathname === p || pathname.startsWith(`${p}/`),
        )
    ) {
        // admin はユーザー認証で通過
        if (authToken) {
            const auth = await verifyAuthToken(authToken);
            if (auth?.role === 'admin') {
                debugLog('allow content with admin token', {
                    pathname,
                    role: auth.role,
                });
                return NextResponse.next();
            }
        }
        // 一般ユーザーはアクセスコードで通過
        if (accessToken) {
            const access = await verifyToken<AccessPayload>(accessToken);
            if (access) {
                debugLog('allow content with access token', {
                    pathname,
                });
                return NextResponse.next();
            }
        }
        debugLog('redirect:/access no valid token for content', {
            pathname,
            hasAuthToken: Boolean(authToken),
            hasAccessToken: Boolean(accessToken),
        });
        return NextResponse.redirect(new URL('/access', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
