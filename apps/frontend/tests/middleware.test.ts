import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { NextRequest } from 'next/server';
import { verify } from 'hono/jwt';
import { middleware } from '@frontend/middleware';

jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
}));
const mockBackendFetch = jest.mocked(fetchFromBackend);

// hono/jwt の verify をモック化し、JWT の実署名検証をテストから分離する
jest.mock('hono/jwt', () => ({
    verify: jest.fn(),
}));

const mockVerify = verify as jest.Mock;

/**
 * テスト用 NextRequest を生成するヘルパー。
 * cookies は Cookie ヘッダーとして渡す (NextRequest のクッキーパーサーが参照する)。
 */
function createRequest(
    pathname: string,
    cookies: Record<string, string> = {},
): NextRequest {
    const cookieStr = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    const init: RequestInit = cookieStr
        ? { headers: { cookie: cookieStr } }
        : {};
    return new NextRequest(`http://localhost${pathname}`, init);
}

const adminPayload = {
    id: 'admin-id',
    role: 'admin',
    exp: 9_999_999_999,
};
const accessPayload = { event_id: 'event-1', exp: 9_999_999_999 };

beforeEach(() => {
    mockVerify.mockReset();
    mockBackendFetch.mockReset();
    mockBackendFetch.mockImplementation(
        async () => new Response(JSON.stringify(adminPayload)),
    );
});

// ─── 公開ページ ───────────────────────────────────────────────────────────────

describe('公開ページ', () => {
    it('/login は認証なしで通過できること', async () => {
        const res = await middleware(createRequest('/login'));
        expect(res.headers.get('location')).toBeNull();
    });

    it('/register は認証なしで通過できること', async () => {
        const res = await middleware(createRequest('/register'));
        expect(res.headers.get('location')).toBeNull();
    });

    it('/access は認証なしで通過できること', async () => {
        const res = await middleware(createRequest('/access'));
        expect(res.headers.get('location')).toBeNull();
    });

    it('有効な auth_token がある場合 /login から /dashboard にリダイレクトされること', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        const res = await middleware(
            createRequest('/login', { auth_token: 'valid.admin.token' }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/dashboard');
    });

    it('user ロールの auth_token では /login に留まること', async () => {
        mockVerify.mockResolvedValue({
            id: 'user-id',
            role: 'user',
            exp: 9_999_999_999,
        });
        const res = await middleware(
            createRequest('/login', { auth_token: 'user.token' }),
        );
        expect(res.headers.get('location')).toBeNull();
    });

    it('有効な access_token がある場合 /access から / にリダイレクトされること', async () => {
        mockVerify.mockResolvedValue(accessPayload);
        const res = await middleware(
            createRequest('/access', { access_token: 'valid.access.token' }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/');
    });

    it('admin の auth_token がある場合 /access から / にリダイレクトされること', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        const res = await middleware(
            createRequest('/access', { auth_token: 'valid.admin.token' }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/');
    });

    it('user ロールの auth_token では /access に留まること', async () => {
        mockVerify.mockResolvedValue({
            id: 'user-id',
            role: 'user',
            exp: 9_999_999_999,
        });
        const res = await middleware(
            createRequest('/access', { auth_token: 'user.token' }),
        );
        expect(res.headers.get('location')).toBeNull();
    });
});

// ─── /admin/* 保護 ────────────────────────────────────────────────────────────

describe('/admin/* 保護', () => {
    it('admin ロールの auth_token があれば通過できること', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        const res = await middleware(
            createRequest('/admin/dashboard', {
                auth_token: 'valid.admin.token',
            }),
        );
        expect(res.headers.get('location')).toBeNull();
    });

    it('auth_token がない場合は /login にリダイレクトされること', async () => {
        const res = await middleware(createRequest('/admin/dashboard'));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/login');
    });

    it('user ロールのトークンは /login にリダイレクトされること', async () => {
        mockVerify.mockResolvedValue({
            id: 'user-id',
            role: 'user',
            exp: 9_999_999_999,
        });
        const res = await middleware(
            createRequest('/admin/dashboard', { auth_token: 'user.token' }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/login');
    });
});

// ─── /dashboard 保護 ──────────────────────────────────────────────────────────

describe('/dashboard 保護', () => {
    it('admin ロールの auth_token があれば通過できること', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        const res = await middleware(
            createRequest('/dashboard', { auth_token: 'valid.admin.token' }),
        );
        expect(res.headers.get('location')).toBeNull();
    });

    it('auth_token がない場合は /login にリダイレクトされること', async () => {
        const res = await middleware(createRequest('/dashboard'));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/login');
    });

    it('user ロールのトークンは /login にリダイレクトされること', async () => {
        mockVerify.mockResolvedValue({
            id: 'user-id',
            role: 'user',
            exp: 9_999_999_999,
        });
        const res = await middleware(
            createRequest('/dashboard', { auth_token: 'user.token' }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/login');
    });
});

// ─── コンテンツページ保護 ─────────────────────────────────────────────────────

describe('コンテンツページ保護', () => {
    it('admin の auth_token があればコンテンツページを通過できること', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        const res = await middleware(
            createRequest('/', { auth_token: 'valid.admin.token' }),
        );
        expect(res.headers.get('location')).toBeNull();
    });

    it('有効な access_token があれば一般ユーザーはコンテンツページを通過できること', async () => {
        mockVerify.mockResolvedValue(accessPayload);
        const res = await middleware(
            createRequest('/events', { access_token: 'valid.access.token' }),
        );
        expect(res.headers.get('location')).toBeNull();
    });

    it('認証なしでは /access にリダイレクトされること', async () => {
        const res = await middleware(createRequest('/'));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/access');
    });

    it('認証なしで /rooms, /shop サブパスでも /access にリダイレクトされること', async () => {
        const paths = ['/rooms', '/shop', '/search'];
        for (const path of paths) {
            const res = await middleware(createRequest(path));
            expect(res.status).toBe(307);
            expect(res.headers.get('location')).toContain('/access');
        }
    });
});

// ─── fail-closed: JWT_SECRET 未設定 / 不正署名 ────────────────────────────────

describe('fail-closed: verify エラー時はアクセス拒否', () => {
    it('/admin/* へのアクセスは verify エラーで /login にリダイレクトされること', async () => {
        mockVerify.mockRejectedValue(
            new Error('signature verification failed'),
        );
        const res = await middleware(
            createRequest('/admin/dashboard', {
                auth_token: 'tampered.token',
            }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/login');
    });

    it('コンテンツページへのアクセスは verify エラーで /access にリダイレクトされること', async () => {
        // auth_token・access_token 両方を渡しても両方 verify が失敗する場合
        mockVerify.mockRejectedValue(new Error('invalid secret'));
        const res = await middleware(
            createRequest('/', {
                auth_token: 'tampered.token',
                access_token: 'tampered.access',
            }),
        );
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toContain('/access');
    });
});

describe('現在のアカウント状態による保護', () => {
    it('古い管理者トークンでも降格後は管理画面へ入れない', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        mockBackendFetch.mockResolvedValue(
            new Response(JSON.stringify({ ...adminPayload, role: 'user' })),
        );
        const res = await middleware(
            createRequest('/admin/access-codes', {
                auth_token: 'old.admin.token',
            }),
        );
        expect(res.headers.get('location')).toContain('/login');
    });
    it('削除後は古い管理者トークンでログイン画面から転送されない', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        mockBackendFetch.mockResolvedValue(new Response('{}', { status: 401 }));
        const res = await middleware(
            createRequest('/login', { auth_token: 'deleted.admin.token' }),
        );
        expect(res.headers.get('location')).toBeNull();
    });
    it('認証情報の確認が失敗した場合は管理画面へ入れない', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        mockBackendFetch.mockRejectedValue(new Error('offline'));
        const res = await middleware(
            createRequest('/dashboard', { auth_token: 'old.admin.token' }),
        );
        expect(res.status).toBe(503);
        expect(res.headers.get('location')).toBeNull();
        expect(await res.text()).toContain('もう一度試す');
    });
});

describe('認証の一時障害と会期閲覧', () => {
    it.each(['/dashboard', '/admin/access-codes', '/rooms'])(
        '%sで503ならログイン画面へ転送せず再試行を案内する',
        async (path) => {
            mockVerify.mockResolvedValue(adminPayload);
            mockBackendFetch.mockResolvedValue(
                new Response('{}', { status: 503 }),
            );
            const response = await middleware(
                createRequest(path, { auth_token: 'admin.token' }),
            );
            expect(response.status).toBe(503);
            expect(response.headers.get('location')).toBeNull();
            expect(response.headers.get('Retry-After')).toBe('30');
            expect(response.headers.get('Cache-Control')).toBe('no-store');
            expect(await response.text()).toContain('再試行');
        },
    );
    it('403は所属確認の案内を表示し未認証と混同しない', async () => {
        mockVerify.mockResolvedValue(adminPayload);
        mockBackendFetch.mockResolvedValue(new Response('{}', { status: 403 }));
        const response = await middleware(
            createRequest('/dashboard', { auth_token: 'admin.token' }),
        );
        expect(response.status).toBe(403);
        expect(response.headers.get('location')).toBeNull();
        expect(await response.text()).toContain('管理者に');
    });
    it('有効な会期トークンで閲覧できる場合は認証DBを照会しない', async () => {
        mockVerify.mockImplementation(async (token) =>
            token === 'access.token' ? accessPayload : adminPayload,
        );
        mockBackendFetch.mockRejectedValue(new Error('offline'));
        const response = await middleware(
            createRequest('/rooms', {
                auth_token: 'admin.token',
                access_token: 'access.token',
            }),
        );
        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
        expect(mockBackendFetch).not.toHaveBeenCalled();
    });
});
