import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '@frontend/app/register/page';

describe('RegisterPage', () => {
    it('フォームフィールドが正しくレンダリングされること', () => {
        render(<RegisterPage />);

        expect(screen.getByLabelText('名前')).toBeInTheDocument();
        expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
        expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
        expect(
            screen.getByLabelText('パスワード（確認用）'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '登録する' }),
        ).toBeInTheDocument();
    });

    it('空送信時に名前フィールドのバリデーションエラーが表示されること', async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);

        await screen.findByRole('option', { name: '企画部' });
        await user.selectOptions(screen.getByLabelText('所属部署'), '60000000-0000-4000-8000-000000000001');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        await waitFor(() => {
            expect(
                screen.getByText(/名前/, { selector: 'p' }),
            ).toBeInTheDocument();
        });
    });

    it('パスワードが不一致の場合エラーが表示されること', async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);

        await user.type(screen.getByLabelText('名前'), '山田太郎');
        await user.type(
            screen.getByLabelText('メールアドレス'),
            'new@example.com',
        );
        await user.type(screen.getByLabelText('パスワード'), 'password123');
        await user.type(
            screen.getByLabelText('パスワード（確認用）'),
            'different456',
        );
        await screen.findByRole('option', { name: '企画部' });
        await user.selectOptions(screen.getByLabelText('所属部署'), '60000000-0000-4000-8000-000000000001');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        await waitFor(() => {
            expect(
                screen.getByText('パスワードが一致しません'),
            ).toBeInTheDocument();
        });
    });

    it('正常な入力で送信すると成功メッセージが表示されること', async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);

        await user.type(screen.getByLabelText('名前'), '山田太郎');
        await user.type(
            screen.getByLabelText('メールアドレス'),
            'new@example.com',
        );
        await user.type(screen.getByLabelText('パスワード'), 'password123');
        await user.type(
            screen.getByLabelText('パスワード（確認用）'),
            'password123',
        );
        await screen.findByRole('option', { name: '企画部' });
        await user.selectOptions(screen.getByLabelText('所属部署'), '60000000-0000-4000-8000-000000000001');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        await waitFor(() => {
            expect(
                screen.getByText('登録が完了しました！'),
            ).toBeInTheDocument();
        });
    });

    it('メールアドレスが重複している場合、メールフィールドにエラーが表示されること', async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);

        // handlers.ts で test@example.com は 400 + 重複エラーを返す
        await user.type(screen.getByLabelText('名前'), '山田太郎');
        await user.type(
            screen.getByLabelText('メールアドレス'),
            'test@example.com',
        );
        await user.type(screen.getByLabelText('パスワード'), 'password123');
        await user.type(
            screen.getByLabelText('パスワード（確認用）'),
            'password123',
        );
        await screen.findByRole('option', { name: '企画部' });
        await user.selectOptions(screen.getByLabelText('所属部署'), '60000000-0000-4000-8000-000000000001');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        await waitFor(() => {
            // page.tsx: setError('email', ...) でメールフィールド下に表示される
            expect(
                screen.getByText('このメールアドレスは既に使用されています'),
            ).toBeInTheDocument();
        });
    });

    it('サーバーエラー時にフォーム上部にグローバルエラーが表示されること', async () => {
        const user = userEvent.setup();
        render(<RegisterPage />);

        // handlers.ts で error@example.com は 500 + サーバーエラーを返す
        await user.type(screen.getByLabelText('名前'), '山田太郎');
        await user.type(
            screen.getByLabelText('メールアドレス'),
            'error@example.com',
        );
        await user.type(screen.getByLabelText('パスワード'), 'password123');
        await user.type(
            screen.getByLabelText('パスワード（確認用）'),
            'password123',
        );
        await screen.findByRole('option', { name: '企画部' });
        await user.selectOptions(screen.getByLabelText('所属部署'), '60000000-0000-4000-8000-000000000001');
        await user.click(screen.getByRole('button', { name: '登録する' }));

        await waitFor(() => {
            // page.tsx: setServerError(...) でフォーム上部の <p> に表示される
            expect(
                screen.getByText('ユーザーの作成に失敗しました'),
            ).toBeInTheDocument();
        });
    });
});
