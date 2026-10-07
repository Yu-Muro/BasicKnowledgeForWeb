import { http, HttpResponse } from 'msw';

export const handlers = [
    http.get('http://localhost:8080/api/auth/me', ({ request }) => {
        const token = /auth_token=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
        if (!token) return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        try { return HttpResponse.json(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())); }
        catch { return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    }),
    http.get('http://localhost:8080/api/departments', () => HttpResponse.json({ departments: [{ id: '60000000-0000-4000-8000-000000000001', name: '企画部' }] })),
    http.post('http://localhost:8080/api/users', async ({ request }) => {
        const body = (await request.json()) as {
            name: string;
            email: string;
            password: string;
        };

        // 重複メールエラー: メールフィールドにエラーを表示するケース
        if (body.email === 'test@example.com') {
            return HttpResponse.json(
                { error: 'このメールアドレスは既に使用されています' },
                { status: 400 },
            );
        }

        // サーバーエラー: フォーム上部にグローバルエラーを表示するケース
        if (body.email === 'error@example.com') {
            return HttpResponse.json(
                { error: 'ユーザーの作成に失敗しました' },
                { status: 500 },
            );
        }

        return HttpResponse.json(
            {
                user: {
                    id: 1,
                    name: body.name,
                    email: body.email,
                    role: 'user',
                },
            },
            { status: 201 },
        );
    }),
    http.post('http://localhost:8080/api/auth/login', async ({ request }) => {
        const body = (await request.json()) as {
            email: string;
            password: string;
        };

        if (
            body.email === 'admin@example.com' &&
            body.password === 'password123'
        ) {
            return HttpResponse.json({ message: 'ログインしました' }, { status: 200 });
        }

        return HttpResponse.json(
            { error: 'メールアドレスまたはパスワードが正しくありません' },
            { status: 401 },
        );
    }),
    http.post(
        'http://localhost:8080/api/access-codes/verify',
        async ({ request }) => {
            const body = (await request.json()) as {
                code: string;
            };

            if (body.code === 'SUMMER2025') {
                return HttpResponse.json(
                    { message: 'アクセスコードを確認しました' },
                    { status: 200 },
                );
            }

            if (body.code === 'EXPIRED2025') {
                return HttpResponse.json(
                    { error: 'アクセスコードの有効期限が切れています' },
                    { status: 401 },
                );
            }

            return HttpResponse.json(
                { error: 'アクセスコードが正しくありません' },
                { status: 401 },
            );
        },
    ),
];
