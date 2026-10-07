'use client';
import { restoreUserAction } from '@frontend/app/actions/dashboard';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
export type DeletedUser = {
    id: string;
    name: string;
    email: string;
    role: string;
};
type Props = {
    initialUsers: DeletedUser[];
    departments: { id: string; name: string }[];
    loadError?: string;
};
export default function DeletedUserPanel({
    initialUsers,
    departments,
    loadError,
}: Props) {
    const router = useRouter();
    const [users, setUsers] = useState(initialUsers);
    const [selected, setSelected] = useState<Record<string, string>>({});
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);
    const restore = (user: DeletedUser) => {
        if (!confirm(`「${user.name}」を復元しますか？`)) return;
        setPendingId(user.id);
        setError(null);
        setMessage(null);
        startTransition(async () => {
            const result = await restoreUserAction(
                user.id,
                selected[user.id] || undefined,
            );
            setPendingId(null);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setUsers((prev) => prev.filter((entry) => entry.id !== user.id));
            setMessage(
                'ユーザーを復元しました。本人に再ログインを依頼してください',
            );
            router.refresh();
        });
    };
    return (
        <section aria-labelledby='deleted-users-heading'>
            <h2
                id='deleted-users-heading'
                className='mb-4 font-semibold text-lg'
            >
                削除済みユーザー
            </h2>
            <p className='mb-4 text-muted-foreground text-sm'>
                メールアドレスは再利用できません。再び利用する場合はアカウントを復元してください。ロールとパスワードは削除前の設定を引き継ぎます。
            </p>
            {(error || loadError) && (
                <p role='alert' className='mb-3 text-destructive text-sm'>
                    {error || loadError}
                </p>
            )}
            {message && (
                <p role='status' className='mb-3 text-sm'>
                    {message}
                </p>
            )}
            {loadError && (
                <button
                    type='button'
                    onClick={() => router.refresh()}
                    className='rounded border px-3 py-2 text-sm'
                >
                    一覧を再取得
                </button>
            )}
            {!loadError && users.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                    削除済みユーザーはいません
                </p>
            )}
            <div className='space-y-3'>
                {users.map((user) => (
                    <div
                        key={user.id}
                        className='rounded-lg border border-border bg-card p-4'
                    >
                        <p className='font-medium'>{user.name}</p>
                        <p className='break-all text-muted-foreground text-sm'>
                            {user.email}
                        </p>
                        <p className='mt-1 text-sm'>
                            ロール:{' '}
                            {user.role === 'admin' ? '管理者' : 'スタッフ'}
                        </p>
                        <div className='mt-3 flex flex-wrap items-center gap-2'>
                            <select
                                aria-label={`${user.name}の復元先部署`}
                                value={selected[user.id] ?? ''}
                                disabled={!!pendingId}
                                onChange={(event) =>
                                    setSelected((prev) => ({
                                        ...prev,
                                        [user.id]: event.target.value,
                                    }))
                                }
                                className='rounded border border-input bg-background px-2 py-2 text-sm'
                            >
                                <option value=''>
                                    {user.role === 'admin'
                                        ? '所属なし（任意）'
                                        : '部署を選択'}
                                </option>
                                {departments.map((department) => (
                                    <option
                                        key={department.id}
                                        value={department.id}
                                    >
                                        {department.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type='button'
                                disabled={
                                    !!pendingId ||
                                    (user.role !== 'admin' &&
                                        !selected[user.id])
                                }
                                onClick={() => restore(user)}
                                className='rounded bg-primary px-3 py-2 text-primary-foreground text-sm disabled:opacity-50'
                            >
                                {pendingId === user.id ? '復元中…' : '復元'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
