import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@frontend/app/actions/dashboard', () => ({
    changePasswordAction: jest.fn(),
    updateUserRoleAction: jest.fn(),
}));
jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
}));

const actions =
    require('@frontend/app/actions/dashboard') as typeof import('@frontend/app/actions/dashboard');
const backendFetch =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const PasswordChangeForm =
    require('@frontend/app/(authenticated)/dashboard/PasswordChangeForm')
        .default as typeof import('@frontend/app/(authenticated)/dashboard/PasswordChangeForm').default;

const mockChangePassword = jest.mocked(actions.changePasswordAction);
const mockFetchFromBackend = jest.mocked(backendFetch.fetchFromBackend);

beforeEach(() => {
    jest.resetAllMocks();
    mockFetchFromBackend.mockResolvedValue(
        new Response(
            JSON.stringify({
                id: 'user-1',
                name: '山田太郎',
                email: 'yamada@example.com',
                role: 'user',
            }),
            { status: 200 },
        ),
    );
});

describe('PasswordChangeForm', () => {
    it.each([128, 129])(
        '%s文字の新しいパスワードで認証と同じ上限を適用する',
        async (length) => {
            mockChangePassword.mockResolvedValue({
                success: false,
                error: 'test-response',
            });
            render(<PasswordChangeForm />);
            fireEvent.change(screen.getByLabelText('現在のパスワード'), {
                target: { value: 'current-password' },
            });
            fireEvent.change(screen.getByLabelText('新しいパスワード'), {
                target: { value: 'A'.repeat(length) },
            });
            fireEvent.change(screen.getByLabelText('確認'), {
                target: { value: 'A'.repeat(length) },
            });
            await act(async () => {
                fireEvent.click(
                    screen.getByRole('button', { name: '変更する' }),
                );
            });
            if (length === 128) {
                expect(mockChangePassword).toHaveBeenCalledWith({
                    currentPassword: 'current-password',
                    newPassword: 'A'.repeat(128),
                });
            } else {
                expect(mockChangePassword).not.toHaveBeenCalled();
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'パスワードは128文字以内で入力してください',
                );
            }
        },
    );
    it('入力フォームを表示する', () => {
        render(<PasswordChangeForm />);

        expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
        expect(screen.getByLabelText('確認')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '変更する' }),
        ).toBeInTheDocument();
    });

    it('空欄の場合にバリデーションエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<PasswordChangeForm />);

        await user.click(screen.getByRole('button', { name: '変更する' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'すべての項目を入力してください',
        );
        expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('新しいパスワードが8文字未満のときバリデーションエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<PasswordChangeForm />);

        await user.type(screen.getByLabelText('現在のパスワード'), 'oldpass');
        await user.type(screen.getByLabelText('新しいパスワード'), 'short');
        await user.type(screen.getByLabelText('確認'), 'short');
        await user.click(screen.getByRole('button', { name: '変更する' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '新しいパスワードは8文字以上で入力してください',
        );
        expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('確認用パスワードが一致しない場合にエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<PasswordChangeForm />);

        await user.type(screen.getByLabelText('現在のパスワード'), 'oldpass');
        await user.type(
            screen.getByLabelText('新しいパスワード'),
            'newpassword1',
        );
        await user.type(screen.getByLabelText('確認'), 'newpassword2');
        await user.click(screen.getByRole('button', { name: '変更する' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '新しいパスワードと確認用パスワードが一致しません',
        );
        expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('正常にパスワード変更できる場合に成功メッセージを表示する', async () => {
        const user = userEvent.setup();
        mockChangePassword.mockResolvedValue({ success: true });
        render(<PasswordChangeForm />);

        await user.type(
            screen.getByLabelText('現在のパスワード'),
            'currentpass',
        );
        await user.type(
            screen.getByLabelText('新しいパスワード'),
            'newpassword1',
        );
        await user.type(screen.getByLabelText('確認'), 'newpassword1');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '変更する' }));
        });

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                'パスワードを変更しました',
            );
        });
        expect(mockChangePassword).toHaveBeenCalledWith({
            currentPassword: 'currentpass',
            newPassword: 'newpassword1',
        });
        expect(mockFetchFromBackend).not.toHaveBeenCalled();
        expect(
            screen.getByRole('link', { name: 'ログイン画面へ' }),
        ).toHaveAttribute('href', '/login');
        expect(screen.getByRole('status')).toHaveTextContent(
            '再ログインしてください',
        );
    });

    it('API エラー時にエラーメッセージを表示する', async () => {
        const user = userEvent.setup();
        mockChangePassword.mockResolvedValue({
            success: false,
            error: '現在のパスワードが正しくありません',
        });
        render(<PasswordChangeForm />);

        await user.type(screen.getByLabelText('現在のパスワード'), 'wrongpass');
        await user.type(
            screen.getByLabelText('新しいパスワード'),
            'newpassword1',
        );
        await user.type(screen.getByLabelText('確認'), 'newpassword1');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '変更する' }));
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                '現在のパスワードが正しくありません',
            );
        });
        expect(mockFetchFromBackend).not.toHaveBeenCalled();
    });

    it('成功後にフォームをリセットする', async () => {
        const user = userEvent.setup();
        mockChangePassword.mockResolvedValue({ success: true });
        render(<PasswordChangeForm />);

        await user.type(
            screen.getByLabelText('現在のパスワード'),
            'currentpass',
        );
        await user.type(
            screen.getByLabelText('新しいパスワード'),
            'newpassword1',
        );
        await user.type(screen.getByLabelText('確認'), 'newpassword1');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '変更する' }));
        });

        await waitFor(() => {
            expect(screen.getByLabelText('現在のパスワード')).toHaveValue('');
            expect(screen.getByLabelText('新しいパスワード')).toHaveValue('');
            expect(screen.getByLabelText('確認')).toHaveValue('');
        });
    });
});
