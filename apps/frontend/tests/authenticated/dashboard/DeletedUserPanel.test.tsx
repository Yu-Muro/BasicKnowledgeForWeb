import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@frontend/app/actions/dashboard', () => ({
    restoreUserAction: jest.fn(),
}));
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const { restoreUserAction } =
    require('@frontend/app/actions/dashboard') as typeof import('@frontend/app/actions/dashboard');
const DeletedUserPanel =
    require('@frontend/app/(authenticated)/dashboard/DeletedUserPanel')
        .default as typeof import('@frontend/app/(authenticated)/dashboard/DeletedUserPanel').default;
const users = [
    {
        id: 'u1',
        name: '削除されたスタッフ',
        email: 'staff@test.com',
        role: 'user',
    },
];
const departments = [{ id: 'd1', name: '総務' }];
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
});
describe('DeletedUserPanel', () => {
    it('一般ユーザーは部署選択後に復元でき、成功後に一覧から消える', async () => {
        jest.mocked(restoreUserAction).mockResolvedValue({ success: true });
        const client = userEvent.setup();
        render(
            <DeletedUserPanel initialUsers={users} departments={departments} />,
        );
        expect(screen.getByRole('button', { name: '復元' })).toBeDisabled();
        await client.selectOptions(
            screen.getByLabelText('削除されたスタッフの復元先部署'),
            'd1',
        );
        await client.click(screen.getByRole('button', { name: '復元' }));
        await waitFor(() =>
            expect(restoreUserAction).toHaveBeenCalledWith('u1', 'd1'),
        );
        expect(
            screen.queryByText('削除されたスタッフ'),
        ).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('再ログイン');
        expect(refresh).toHaveBeenCalled();
    });
    it('管理者は部署なしで復元できる', async () => {
        jest.mocked(restoreUserAction).mockResolvedValue({ success: true });
        render(
            <DeletedUserPanel
                initialUsers={[{ ...users[0], role: 'admin' }]}
                departments={departments}
            />,
        );
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: '復元' }));
        await waitFor(() =>
            expect(restoreUserAction).toHaveBeenCalledWith('u1', undefined),
        );
    });
    it('復元に失敗した場合は対象を残してエラーを表示する', async () => {
        jest.mocked(restoreUserAction).mockResolvedValue({
            success: false,
            error: '移行中です',
        });
        render(
            <DeletedUserPanel
                initialUsers={[{ ...users[0], role: 'admin' }]}
                departments={departments}
            />,
        );
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: '復元' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            '移行中です',
        );
        expect(screen.getByText('削除されたスタッフ')).toBeInTheDocument();
    });
    it('確認を取り消した場合は復元しない', async () => {
        jest.mocked(window.confirm).mockReturnValue(false);
        render(
            <DeletedUserPanel
                initialUsers={[{ ...users[0], role: 'admin' }]}
                departments={departments}
            />,
        );
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: '復元' }));
        expect(restoreUserAction).not.toHaveBeenCalled();
    });
    it('一覧取得失敗を空一覧と区別して再取得できる', async () => {
        render(
            <DeletedUserPanel
                initialUsers={[]}
                departments={departments}
                loadError='取得失敗'
            />,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('取得失敗');
        expect(
            screen.queryByText('削除済みユーザーはいません'),
        ).not.toBeInTheDocument();
        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: '一覧を再取得' }));
        expect(refresh).toHaveBeenCalled();
    });
});
