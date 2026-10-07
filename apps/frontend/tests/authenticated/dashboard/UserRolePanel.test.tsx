import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: jest.fn(),
        prefetch: jest.fn(),
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
    }),
}));

jest.mock('@frontend/app/actions/dashboard', () => ({
    changePasswordAction: jest.fn(),
    updateUserRoleAction: jest.fn(),
    updateUserDepartmentAction: jest.fn(),
    deleteUserAction: jest.fn(),
}));

const actions =
    require('@frontend/app/actions/dashboard') as typeof import('@frontend/app/actions/dashboard');
const UserRolePanel =
    require('@frontend/app/(authenticated)/dashboard/UserRolePanel')
        .default as typeof import('@frontend/app/(authenticated)/dashboard/UserRolePanel').default;

const mockUpdateRole = jest.mocked(actions.updateUserRoleAction);

const MOCK_USERS = [
    { id: 'user-1', name: '山田太郎', email: 'yamada@example.com', departmentId: 'dept-1', role: 'user' as const },
    { id: 'user-2', name: '管理者A', email: 'admin@example.com', role: 'admin' as const },
];

beforeEach(() => {
    jest.resetAllMocks();
});

describe('UserRolePanel', () => {
    it('ユーザー一覧を表示する', () => {
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={MOCK_USERS} />);

        expect(screen.getAllByText('山田太郎').length).toBeGreaterThan(0);
        expect(screen.getAllByText('管理者A').length).toBeGreaterThan(0);
        expect(
            screen.getAllByText('yamada@example.com').length,
        ).toBeGreaterThan(0);
    });

    it('各ユーザーに変更ボタンを表示する', () => {
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={MOCK_USERS} />);

        expect(screen.getAllByRole('button', { name: '変更' })).toHaveLength(4);
    });

    it('ユーザーがいない場合に空メッセージを表示する', () => {
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={[]} />);

        expect(
            screen.getByText('登録されているユーザーはありません'),
        ).toBeInTheDocument();
    });

    it('変更ボタンクリックで updateUserRoleAction を呼ぶ', async () => {
        const user = userEvent.setup();
        mockUpdateRole.mockResolvedValue({
            success: true,
            data: Array.from(MOCK_USERS),
        });
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={MOCK_USERS} />);

        const changeButtons = screen.getAllByRole('button', { name: '変更' });
        await act(async () => {
            await user.click(changeButtons[0]);
        });

        await waitFor(() => {
            expect(mockUpdateRole).toHaveBeenCalledWith('user-1', 'user', 'dept-1');
        });
    });

    it('ロールを選択して変更ボタンを押すと新しいロールで呼ばれる', async () => {
        const user = userEvent.setup();
        mockUpdateRole.mockResolvedValue({
            success: true,
            data: [
                { ...MOCK_USERS[0], role: 'admin' },
                MOCK_USERS[1],
            ],
        });
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={MOCK_USERS} />);

        const selects = screen.getAllByRole('combobox', {
            name: '山田太郎のロール',
        });
        await user.selectOptions(selects[0], 'admin');

        const changeButtons = screen.getAllByRole('button', { name: '変更' });
        await act(async () => {
            await user.click(changeButtons[0]);
        });

        await waitFor(() => {
            expect(mockUpdateRole).toHaveBeenCalledWith('user-1', 'admin', undefined);
        });
    });

    it('スナップショットが古くても更新対象ユーザーの表示ロールは新しい値を維持する', async () => {
        const user = userEvent.setup();
        // あえて古い一覧（user-1 が user のまま）を返す
        mockUpdateRole.mockResolvedValue({
            success: true,
            data: Array.from(MOCK_USERS),
        });
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={MOCK_USERS} />);

        const selects = screen.getAllByRole('combobox', {
            name: '山田太郎のロール',
        });
        await user.selectOptions(selects[0], 'admin');

        const changeButtons = screen.getAllByRole('button', { name: '変更' });
        await act(async () => {
            await user.click(changeButtons[0]);
        });

        await waitFor(() => {
            expect(mockUpdateRole).toHaveBeenCalledWith('user-1', 'admin', undefined);
        });
        expect(selects[0]).toHaveValue('admin');
    });

    it('アクション失敗時にエラーメッセージを表示する', async () => {
        const user = userEvent.setup();
        mockUpdateRole.mockResolvedValue({
            success: false,
            error: 'ロールの変更に失敗しました',
        });
        render(<UserRolePanel departments={[{ id: 'dept-1', name: '企画部' }]} currentUserId='admin-1' initialUsers={MOCK_USERS} />);

        const changeButtons = screen.getAllByRole('button', { name: '変更' });
        await act(async () => {
            await user.click(changeButtons[0]);
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                'ロールの変更に失敗しました',
            );
        });
    });
});

describe('所属部署とユーザー削除', () => {
    const departments = [{ id: 'dept-1', name: '企画部' }];
    it('既存の所属未設定ユーザーを表示する', () => {
        render(<UserRolePanel initialUsers={[{ ...MOCK_USERS[0], departmentId: null }]} departments={departments} currentUserId='user-2' />);
        expect(screen.getAllByText('所属未設定')).toHaveLength(2);
    });
    it('部署を選択して管理者が保存する', async () => {
        const user = userEvent.setup();
        jest.mocked(actions.updateUserDepartmentAction).mockResolvedValue({ success: true, data: MOCK_USERS });
        render(<UserRolePanel initialUsers={[{ ...MOCK_USERS[0], departmentId: null }]} departments={departments} currentUserId='user-2' />);
        await user.selectOptions(screen.getAllByRole('combobox', { name: '山田太郎の部署' })[0], 'dept-1');
        await user.click(screen.getAllByRole('button', { name: '部署を保存' })[0]);
        await waitFor(() => expect(actions.updateUserDepartmentAction).toHaveBeenCalledWith('user-1', 'dept-1'));
        expect(screen.getByRole('status')).toHaveTextContent('所属部署を更新しました');
    });
    it('部署未選択の一般ユーザーへの変更を拒否する', async () => {
        const user = userEvent.setup();
        render(<UserRolePanel initialUsers={[{ ...MOCK_USERS[0], departmentId: null }]} departments={departments} currentUserId='user-2' />);
        await user.click(screen.getAllByRole('button', { name: '変更' })[0]);
        expect(mockUpdateRole).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('一般ユーザーには部署を選択してください');
    });
    it('確認後にユーザーを削除し一覧から除く', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
        jest.mocked(actions.deleteUserAction).mockResolvedValue({ success: true, data: [] });
        render(<UserRolePanel initialUsers={[MOCK_USERS[0]]} departments={departments} currentUserId='user-2' />);
        await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
        await waitFor(() => expect(actions.deleteUserAction).toHaveBeenCalledWith('user-1'));
        expect(screen.queryByText('山田太郎')).not.toBeInTheDocument();
    });
    it('確認を取り消した場合は削除しない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(<UserRolePanel initialUsers={[MOCK_USERS[0]]} departments={departments} currentUserId='user-2' />);
        await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
        expect(actions.deleteUserAction).not.toHaveBeenCalled();
    });
    it('自分自身の削除ボタンは無効になる', () => {
        render(<UserRolePanel initialUsers={[MOCK_USERS[0]]} departments={departments} currentUserId='user-1' />);
        for (const button of screen.getAllByRole('button', { name: '削除' })) expect(button).toBeDisabled();
    });
});

describe('部署一覧とユーザー所属が一致しない場合',()=>{
 it('空白や未設定表示にせず、不明な部署を表示する',()=>{
  render(<UserRolePanel departments={[]} currentUserId='admin-1' initialUsers={[{...MOCK_USERS[0],departmentId:'missing-department'}]} />);
  expect(screen.getAllByText('不明な部署')).toHaveLength(2);
  const selectors=screen.getAllByRole('combobox',{name:`${MOCK_USERS[0].name}の部署`});
  for(const selector of selectors) expect(selector).toHaveValue('missing-department');
  for(const button of screen.getAllByRole('button',{name:'部署を保存'})) expect(button).toBeDisabled();
 });
});
