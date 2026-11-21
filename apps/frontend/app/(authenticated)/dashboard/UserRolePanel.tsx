'use client';

import {
    deleteUserAction,
    updateUserDepartmentAction,
    updateUserRoleAction,
} from '@frontend/app/actions/dashboard';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

type User = {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
    departmentId?: string | null;
};

type Props = {
    initialUsers: User[];
    departments: { id: string; name: string }[];
    currentUserId: string;
};

const ROLE_LABELS: Record<string, string> = {
    user: 'スタッフ',
    admin: '管理者',
};

function buildSelectedRoles(users: User[]): Record<string, 'user' | 'admin'> {
    return Object.fromEntries(users.map((u) => [u.id, u.role])) as Record<
        string,
        'user' | 'admin'
    >;
}

export default function UserRolePanel({
    initialUsers,
    departments,
    currentUserId,
}: Props) {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [selectedRoles, setSelectedRoles] = useState<
        Record<string, 'user' | 'admin'>
    >(buildSelectedRoles(initialUsers));
    const [selectedDepartments, setSelectedDepartments] = useState<
        Record<string, string>
    >(
        Object.fromEntries(
            initialUsers.map((u) => [u.id, u.departmentId ?? '']),
        ),
    );
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    useEffect(() => {
        setUsers(initialUsers);
        setSelectedDepartments(
            Object.fromEntries(
                initialUsers.map((u) => [u.id, u.departmentId ?? '']),
            ),
        );
        setSelectedRoles(buildSelectedRoles(initialUsers));
    }, [initialUsers]);

    const handleRoleChange = (userId: string) => {
        const newRole = selectedRoles[userId];
        if (!newRole) return;
        if (newRole === 'user' && !selectedDepartments[userId]) {
            setError('一般ユーザーには部署を選択してください');
            return;
        }

        setError(null);
        setPendingId(userId);
        setInfoMessage(null);
        const currentRole = users.find((u) => u.id === userId)?.role;

        startTransition(async () => {
            const result = await updateUserRoleAction(
                userId,
                newRole,
                newRole === 'user' ? selectedDepartments[userId] : undefined,
            );
            setPendingId(null);
            if (!result.success) {
                setError(result.error);
                if (currentRole) {
                    setSelectedRoles((prev) => ({
                        ...prev,
                        [userId]: currentRole,
                    }));
                }
            } else {
                if (userId === currentUserId && newRole === 'user') {
                    router.replace('/login');
                    return;
                }
                // スナップショットが遅延していても、更新したユーザーのロール表示は確実に反映する。
                const sourceUsers = (result.data ?? users).map((user) =>
                    user.id === userId
                        ? {
                              ...user,
                              role: newRole,
                              departmentId:
                                  newRole === 'user'
                                      ? selectedDepartments[userId]
                                      : currentRole === 'admin'
                                        ? user.departmentId
                                        : null,
                          }
                        : user,
                );
                setUsers(sourceUsers);
                setSelectedRoles(buildSelectedRoles(sourceUsers));
                setSelectedDepartments(
                    Object.fromEntries(
                        sourceUsers.map((user) => [
                            user.id,
                            user.departmentId ?? '',
                        ]),
                    ),
                );
                setError(result.warning ?? null);
                setInfoMessage('ユーザーのロールを更新しました');
                router.refresh();
            }
        });
    };

    const handleDepartmentChange = (userId: string) => {
        const departmentId = selectedDepartments[userId];
        if (!departmentId) {
            setError('部署を選択してください');
            return;
        }
        setError(null);
        setInfoMessage(null);
        setPendingId(userId);
        startTransition(async () => {
            const result = await updateUserDepartmentAction(
                userId,
                departmentId,
            );
            setPendingId(null);
            if (!result.success) {
                setError(result.error);
                return;
            }
            const nextUsers = (result.data ?? users).map((user) =>
                user.id === userId ? { ...user, departmentId } : user,
            );
            setUsers(nextUsers);
            setSelectedRoles(buildSelectedRoles(nextUsers));
            setSelectedDepartments(
                Object.fromEntries(
                    nextUsers.map((user) => [user.id, user.departmentId ?? '']),
                ),
            );
            setError(result.warning ?? null);
            setInfoMessage('所属部署を更新しました');
            router.refresh();
        });
    };
    const handleDelete = (user: User) => {
        if (!confirm(`「${user.name}」を削除しますか？`)) return;
        setError(null);
        setInfoMessage(null);
        setPendingId(user.id);
        startTransition(async () => {
            const result = await deleteUserAction(user.id);
            setPendingId(null);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setUsers(
                (result.data ?? users).filter((entry) => entry.id !== user.id),
            );
            setError(result.warning ?? null);
            setInfoMessage('ユーザーを削除しました');
            router.refresh();
        });
    };
    const departmentControl = (user: User) => (
        <div className='flex flex-col gap-2'>
            <span className='text-muted-foreground text-xs'>
                {user.departmentId
                    ? (departments.find(
                          (department) => department.id === user.departmentId,
                      )?.name ?? '不明な部署')
                    : user.role === 'admin'
                      ? '所属任意'
                      : '所属未設定'}
            </span>
            <select
                aria-label={`${user.name}の部署`}
                value={selectedDepartments[user.id] ?? ''}
                onChange={(event) =>
                    setSelectedDepartments((prev) => ({
                        ...prev,
                        [user.id]: event.target.value,
                    }))
                }
                disabled={!!pendingId}
                className='rounded border border-input bg-background px-2 py-1 text-sm'
            >
                <option value=''>部署を選択</option>
                {selectedDepartments[user.id] &&
                    !departments.some(
                        (department) =>
                            department.id === selectedDepartments[user.id],
                    ) && (
                        <option value={selectedDepartments[user.id]} disabled>
                            不明な部署（一覧を再取得してください）
                        </option>
                    )}
                {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                        {department.name}
                    </option>
                ))}
            </select>
            <button
                type='button'
                onClick={() => handleDepartmentChange(user.id)}
                disabled={
                    !!pendingId ||
                    !departments.some(
                        (department) =>
                            department.id === selectedDepartments[user.id],
                    )
                }
                className='rounded border border-input px-3 py-1 text-xs disabled:opacity-50'
            >
                部署を保存
            </button>
        </div>
    );
    const deleteControl = (user: User) => (
        <button
            type='button'
            onClick={() => handleDelete(user)}
            disabled={!!pendingId || user.id === currentUserId}
            className='ml-2 rounded border border-destructive px-3 py-1 text-destructive text-xs disabled:opacity-50'
        >
            削除
        </button>
    );

    return (
        <section aria-labelledby='user-management-heading'>
            <h2
                id='user-management-heading'
                className='mb-4 font-semibold text-foreground text-lg'
            >
                ユーザー管理
            </h2>
            {infoMessage && (
                <p
                    role='status'
                    className='mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-800 text-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                >
                    {infoMessage}
                </p>
            )}
            {error && (
                <p role='alert' className='mb-3 text-destructive text-sm'>
                    {error}
                </p>
            )}

            {error && infoMessage && (
                <button
                    type='button'
                    onClick={() => router.refresh()}
                    className='mb-4 rounded border px-3 py-2 text-sm'
                >
                    一覧を再取得
                </button>
            )}

            {/* Desktop table */}
            <div className='hidden overflow-x-auto rounded-lg border border-border md:block'>
                <table
                    className='w-full min-w-[800px] text-sm'
                    aria-label='ユーザー一覧'
                >
                    <thead className='bg-muted/50'>
                        <tr>
                            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
                                名前
                            </th>
                            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
                                メール
                            </th>
                            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
                                ロール
                            </th>
                            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
                                所属部署
                            </th>
                            <th className='px-4 py-3 text-left font-medium text-muted-foreground'>
                                操作
                            </th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-card'>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className='px-4 py-3 text-foreground'>
                                    {user.name}
                                </td>
                                <td className='break-all px-4 py-3 text-muted-foreground'>
                                    {user.email}
                                </td>
                                <td className='px-4 py-3'>
                                    <select
                                        aria-label={`${user.name}のロール`}
                                        value={selectedRoles[user.id]}
                                        disabled={!!pendingId}
                                        onChange={(e) =>
                                            setSelectedRoles((prev) => ({
                                                ...prev,
                                                [user.id]: e.target.value as
                                                    | 'user'
                                                    | 'admin',
                                            }))
                                        }
                                        className='rounded border border-input bg-background px-2 py-1 text-sm'
                                    >
                                        <option value='user'>スタッフ</option>
                                        <option value='admin'>管理者</option>
                                    </select>
                                </td>
                                <td className='px-4 py-3'>
                                    {departmentControl(user)}
                                </td>
                                <td className='px-4 py-3'>
                                    <button
                                        type='button'
                                        onClick={() =>
                                            handleRoleChange(user.id)
                                        }
                                        disabled={!!pendingId}
                                        className='rounded bg-primary px-3 py-1 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50'
                                    >
                                        変更
                                    </button>
                                    {deleteControl(user)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile cards */}
            <div className='space-y-3 md:hidden'>
                {users.map((user) => (
                    <div
                        key={user.id}
                        className='rounded-lg border border-border bg-card p-4'
                    >
                        <p className='font-medium text-foreground'>
                            {user.name}
                        </p>
                        <p className='mt-1 break-all text-muted-foreground text-sm'>
                            {user.email}
                        </p>
                        <div className='mt-3'>{departmentControl(user)}</div>
                        <div className='mt-3 flex items-center gap-2'>
                            <select
                                aria-label={`${user.name}のロール`}
                                value={selectedRoles[user.id]}
                                disabled={!!pendingId}
                                onChange={(e) =>
                                    setSelectedRoles((prev) => ({
                                        ...prev,
                                        [user.id]: e.target.value as
                                            | 'user'
                                            | 'admin',
                                    }))
                                }
                                className='flex-1 rounded border border-input bg-background px-2 py-1 text-sm'
                            >
                                <option value='user'>スタッフ</option>
                                <option value='admin'>管理者</option>
                            </select>
                            <button
                                type='button'
                                onClick={() => handleRoleChange(user.id)}
                                disabled={!!pendingId}
                                className='rounded bg-primary px-3 py-1 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50'
                            >
                                変更
                            </button>
                            {deleteControl(user)}
                        </div>
                    </div>
                ))}
            </div>

            {users.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                    登録されているユーザーはありません
                </p>
            )}

            {/* Current role display for reference */}
            <div className='mt-4 hidden'>
                {users.map((u) => (
                    <span key={u.id} data-testid={`role-${u.id}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                ))}
            </div>
        </section>
    );
}
