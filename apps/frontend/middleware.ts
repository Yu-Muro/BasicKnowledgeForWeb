import { verify } from 'hono/jwt';
import { type NextRequest, NextResponse } from 'next/server';
import { AuthLookupError, fetchCurrentUser } from './app/lib/authLookup';

// JWT_SECRET は Edge Runtime では process.env から取得
const JWT_SECRET = process.env.JWT_SECRET ?? '';

type AuthPayload = { id: string; role: string; exp: number };
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
    const auth = await verifyToken<AuthPayload>(token);
    if (!auth) return null;
    const user = await fetchCurrentUser(token);
    if (!user || user.id !== auth.id) return null;
    return { ...auth, role: user.role };
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

async function protectRoute(request: NextRequest) {
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
        if (accessToken && (await verifyToken<AccessPayload>(accessToken)))
            return NextResponse.redirect(new URL('/', request.url));
        if (authToken) {
            const auth = await verifyAuthToken(authToken);
            if (auth?.role === 'admin') {
                debugLog('redirecting /access -> / (admin token)', {
                    role: auth.role,
                });
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
        if (accessToken && (await verifyToken<AccessPayload>(accessToken)))
            return NextResponse.next();
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
        debugLog('redirect:/access no valid token for content', {
            pathname,
            hasAuthToken: Boolean(authToken),
            hasAccessToken: Boolean(accessToken),
        });
        return NextResponse.redirect(new URL('/access', request.url));
    }

    return NextResponse.next();
}

export async function middleware(request: NextRequest) {
    try {
        return await protectRoute(request);
    } catch (error) {
        if (!(error instanceof AuthLookupError)) throw error;
        return new NextResponse(
            `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>認証情報の確認</title></head><body><main><h1>認証情報を確認できませんでした</h1><p>${error.message}</p><p><a href="">もう一度試す</a></p></main></body></html>`,
            {
                status: error.status,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-store',
                    ...(error.status === 503 ? { 'Retry-After': '30' } : {}),
                },
            },
        );
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
