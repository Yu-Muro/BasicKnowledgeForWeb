import AdminFormModal from '@frontend/components/AdminFormModal';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

function Harness({ isPending = false }: { isPending?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type='button' onClick={() => setOpen(true)}>
                追加
            </button>
            <button type='button'>一覧の操作</button>
            {open && (
                <AdminFormModal
                    title='部署を追加'
                    onClose={() => setOpen(false)}
                    isPending={isPending}
                    error='部署名は必須です'
                >
                    <input aria-label='部署名' />
                    <button type='button'>保存</button>
                </AdminFormModal>
            )}
        </>
    );
}

describe('AdminFormModal', () => {
    it('エラーをモーダル内に表示し、Escapeで閉じて操作元へフォーカスを戻す', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        const trigger = screen.getByRole('button', { name: '追加' });
        await user.click(trigger);
        const dialog = screen.getByRole('dialog', { name: '部署を追加' });
        expect(dialog).toContainElement(screen.getByRole('alert'));
        await user.keyboard('{Escape}');
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(trigger).toHaveFocus();
        });
    });

    it('Tab操作のフォーカスをモーダル内に保ち、閉じるボタンで終了できる', async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole('button', { name: '追加' }));
        const dialog = screen.getByRole('dialog');
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: '閉じる' }),
            ).toHaveFocus(),
        );
        for (let i = 0; i < 6; i++) {
            await user.tab();
            await waitFor(() =>
                expect(dialog).toContainElement(
                    document.activeElement as HTMLElement,
                ),
            );
        }
        await user.click(screen.getByRole('button', { name: '閉じる' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('保存中は入力と閉じる操作を無効にし、Escapeでも閉じない', async () => {
        const user = userEvent.setup();
        render(<Harness isPending />);
        await user.click(screen.getByRole('button', { name: '追加' }));
        expect(screen.getByLabelText('部署名')).toBeDisabled();
        expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '閉じる' })).toBeDisabled();
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('背景クリックで閉じ、保存中の背景クリックでは閉じない', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();
        const { rerender } = render(
            <AdminFormModal
                title='部署を編集'
                onClose={onClose}
                isPending={false}
                error={null}
            >
                <input aria-label='部署名' />
            </AdminFormModal>,
        );
        const backdrop = screen.getByTestId('admin-form-backdrop');
        expect(backdrop).not.toBeNull();
        await user.click(backdrop as HTMLElement);
        expect(onClose).toHaveBeenCalledTimes(1);
        onClose.mockClear();
        rerender(
            <AdminFormModal
                title='部署を編集'
                onClose={onClose}
                isPending
                error={null}
            >
                <input aria-label='部署名' />
            </AdminFormModal>,
        );
        await user.click(backdrop as HTMLElement);
        expect(onClose).not.toHaveBeenCalled();
    });
});
