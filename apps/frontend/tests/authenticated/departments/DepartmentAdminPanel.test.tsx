import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
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

jest.mock('@frontend/app/actions/departments', () => ({
    copyDepartmentsFromEventAction: jest.fn(),
    createDepartmentAction: jest.fn(),
    updateDepartmentAction: jest.fn(),
    deleteDepartmentAction: jest.fn(),
}));
jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
}));
jest.mock('@frontend/app/utils/client', () => ({
    client: {
        api: {
            'access-codes': {
                $get: jest.fn(),
            },
        },
    },
}));

const actions =
    require('@frontend/app/actions/departments') as typeof import('@frontend/app/actions/departments');
const backendFetch =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const frontendClient =
    require('@frontend/app/utils/client') as typeof import('@frontend/app/utils/client');
const DepartmentAdminPanel =
    require('@frontend/app/(authenticated)/departments/DepartmentAdminPanel')
        .default as typeof import('@frontend/app/(authenticated)/departments/DepartmentAdminPanel').default;

const mockCreate = jest.mocked(actions.createDepartmentAction);
const mockUpdate = jest.mocked(actions.updateDepartmentAction);
const mockDelete = jest.mocked(actions.deleteDepartmentAction);
const mockCopy = jest.mocked(actions.copyDepartmentsFromEventAction);
const mockFetchFromBackend = jest.mocked(backendFetch.fetchFromBackend);
const mockAccessCodesGet = jest.mocked(
    frontendClient.client.api['access-codes'].$get,
);

const MOCK_DEPARTMENTS = [
    { id: '1', name: '企画部' },
    { id: '2', name: '運営部' },
];

beforeEach(() => {
    jest.resetAllMocks();
    global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
    mockAccessCodesGet.mockResolvedValue({
        ok: false,
        json: async () => ({}),
    } as never);
    mockFetchFromBackend.mockResolvedValue(
        new Response('{}', {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        }),
    );
});

describe('DepartmentAdminPanel', () => {
    it('部署一覧を表示する', () => {
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        expect(screen.getByText('企画部')).toBeInTheDocument();
        expect(screen.getByText('運営部')).toBeInTheDocument();
    });

    it('各部署に編集・削除ボタンを表示する', () => {
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(2);
    });

    it('部署がない場合に空メッセージを表示する', () => {
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        expect(
            screen.getByText('登録されている部署はありません'),
        ).toBeInTheDocument();
    });

    it('+ 追加 ボタンクリックでフォームを表示する', async () => {
        const user = userEvent.setup();
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));

        expect(screen.getByText('新しい部署を追加')).toBeInTheDocument();
        expect(screen.getByLabelText(/部署名/)).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('キャンセルボタンでフォームを閉じる', async () => {
        const user = userEvent.setup();
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        expect(screen.getByText('新しい部署を追加')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'キャンセル' }));
        expect(screen.queryByText('新しい部署を追加')).not.toBeInTheDocument();
    });

    it('編集ボタンで既存の部署名がフォームに入力済みになる', async () => {
        const user = userEvent.setup();
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        expect(
            screen.getByRole('dialog', { name: '部署を編集' }),
        ).toBeInTheDocument();
        expect(screen.getByText('部署を編集')).toBeInTheDocument();
        expect(screen.getByLabelText(/部署名/)).toHaveValue('企画部');
    });

    it('Escapeキーで編集モーダルを閉じて編集ボタンへフォーカスを戻す', async () => {
        const user = userEvent.setup();
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const editButton = screen.getAllByRole('button', { name: '編集' })[0];
        await user.click(editButton);
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(editButton).toHaveFocus();
    });

    it('編集時の入力エラーをモーダル内に表示する', async () => {
        const user = userEvent.setup();
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
        await user.clear(screen.getByLabelText(/部署名/));
        await user.click(screen.getByRole('button', { name: '保存' }));

        const dialog = screen.getByRole('dialog', { name: '部署を編集' });
        expect(dialog).toContainElement(screen.getByRole('alert'));
        expect(screen.getByRole('alert')).toHaveTextContent('部署名は必須です');
    });

    it('フォーム送信で createDepartmentAction を呼ぶ', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValue({
            success: true,
            data: [{ id: '3', name: '新部署' }],
        });
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/部署名/), '新部署');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith('event-1', { name: '新部署' });
        });
    });

    it('編集フォーム送信で updateDepartmentAction を呼ぶ', async () => {
        const user = userEvent.setup();
        mockUpdate.mockResolvedValue({
            success: true,
            data: [
                { id: '1', name: '変更後部署名' },
                MOCK_DEPARTMENTS[1],
            ],
        });
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        const input = screen.getByLabelText(/部署名/);
        await user.clear(input);
        await user.type(input, '変更後部署名');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledWith('event-1', '1', {
                name: '変更後部署名',
            });
        });
    });

    it('削除ボタンクリック + confirm で deleteDepartmentAction を呼ぶ', async () => {
        const user = userEvent.setup();
        mockDelete.mockResolvedValue({
            success: true,
            data: MOCK_DEPARTMENTS.slice(1),
        });
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('event-1', '1');
        });
    });

    it('confirm キャンセル時は deleteDepartmentAction を呼ばない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await user.click(deleteButtons[0]);

        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('部署名が空の場合にバリデーションエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent('部署名は必須です');
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('アクション失敗時にエラーメッセージを表示する', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValue({
            success: false,
            error: '登録に失敗しました',
        });
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/部署名/), '失敗部署');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                '登録に失敗しました',
            );
        });
    });

    it('成功時に成功メッセージを表示しフォームを閉じる', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValue({
            success: true,
            data: [{ id: '3', name: '新部署' }],
        });
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/部署名/), '新部署');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                '部署を追加しました',
            );
            expect(screen.queryByText('新しい部署を追加')).not.toBeInTheDocument();
        });
    });

    it('IME 変換中の Enter では送信しない', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValue({
            success: true,
            data: [{ id: '3', name: '新部署' }],
        });
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        const input = screen.getByLabelText(/部署名/);
        await user.type(input, '新部署');

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
        });

        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('IME 変換確定後の Enter では送信される', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValue({
            success: true,
            data: [{ id: '3', name: '新部署' }],
        });
        render(<DepartmentAdminPanel departments={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        const input = screen.getByLabelText(/部署名/);
        await user.type(input, '新部署');

        await act(async () => {
            fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
        });

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith('event-1', { name: '新部署' });
        });
    });

    it('コピー元会期未選択でコピーするとエラーを表示する', async () => {
        const user = userEvent.setup();
        mockAccessCodesGet.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                codes: [{ id: 'event-2', eventName: '前回会期' }],
            }),
        } as never);
        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'コピーして追加' })).toBeEnabled();
        });
        await user.click(screen.getByRole('button', { name: 'コピーして追加' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'コピー元会期を選択してください',
        );
        expect(mockCopy).not.toHaveBeenCalled();
    });

    it('コピー元会期を選択してコピーできる', async () => {
        const user = userEvent.setup();
        mockAccessCodesGet.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                codes: [
                    { id: 'event-1', eventName: '現在会期' },
                    { id: 'event-2', eventName: '前回会期' },
                ],
            }),
        } as never);
        mockFetchFromBackend.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    departments: [
                        { id: '1', name: '企画部' },
                        { id: '2', name: '運営部' },
                        { id: '3', name: '広報部' },
                    ],
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        );
        mockCopy.mockResolvedValue({
            success: true,
            data: [
                { id: '1', name: '企画部' },
                { id: '2', name: '運営部' },
                { id: '3', name: '広報部' },
            ],
        });

        render(
            <DepartmentAdminPanel
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('option', { name: '前回会期' })).toBeVisible();
        });
        await user.selectOptions(
            screen.getByRole('combobox', { name: 'コピー元会期' }),
            'event-2',
        );

        await act(async () => {
            await user.click(screen.getByRole('button', { name: 'コピーして追加' }));
        });

        await waitFor(() => {
            expect(mockCopy).toHaveBeenCalledWith('event-1', 'event-2');
            expect(screen.getByRole('status')).toHaveTextContent(
                '過去会期から部署をコピーしました',
            );
        });
    });
});
