'use client';

import {
    createDepartmentAction,
    deleteDepartmentAction,
    updateDepartmentAction,
} from '@frontend/app/actions/departments';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { AdminFormContainer } from '@frontend/components/AdminFormContainer';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

type Department = {
    id: string;
    name: string;
};

async function fetchDepartmentsFromApi(): Promise<Department[] | null> {
    try {
        const res = await fetchFromBackend('/api/departments', {
            credentials: 'include',
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { departments?: Department[] };
        return Array.isArray(body.departments) ? body.departments : null;
    } catch {
        return null;
    }
}

type Props = { departments: Department[] };

export default function DepartmentAdminPanel({ departments }: Props) {
    const router = useRouter();
    const [departmentList, setDepartmentList] = useState(departments);
    useEffect(() => {
        setDepartmentList(departments);
    }, [departments]);
    const [formMode, setFormMode] = useState<'idle' | 'adding' | 'editing'>(
        'idle',
    );
    const [editingItem, setEditingItem] = useState<Department | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const openAdd = () => {
        if (isPending) return;
        setName('');
        setEditingItem(null);
        setError(null);
        setInfoMessage(null);
        setFormMode('adding');
    };

    const openEdit = (item: Department) => {
        if (isPending) return;
        setName(item.name);
        setEditingItem(item);
        setError(null);
        setInfoMessage(null);
        setFormMode('editing');
    };

    const closeForm = () => {
        setFormMode('idle');
        setEditingItem(null);
        setError(null);
    };

    const handleSubmit = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('部署名は必須です');
            return;
        }

        startTransition(async () => {
            const result =
                formMode === 'editing' && editingItem
                    ? await updateDepartmentAction(editingItem.id, {
                          name: trimmed,
                      })
                    : await createDepartmentAction({ name: trimmed });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setInfoMessage(
                formMode === 'adding'
                    ? '部署を追加しました'
                    : '部署を更新しました',
            );
            const refreshed = await fetchDepartmentsFromApi();
            setDepartmentList(refreshed ?? result.data);
            router.refresh();
            closeForm();
        });
    };

    const handleDelete = (item: Department) => {
        if (!confirm(`「${item.name}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteDepartmentAction(item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setInfoMessage('部署を削除しました');
            const refreshed = await fetchDepartmentsFromApi();
            setDepartmentList(refreshed ?? result.data);
            router.refresh();
        });
    };

    return (
        <section aria-labelledby='departments-heading'>
            <div className='mb-6 flex items-center justify-between'>
                <div>
                    <h1
                        id='departments-heading'
                        className='font-semibold text-foreground text-xl tracking-tight'
                    >
                        部署管理
                    </h1>
                    <p className='mt-2 text-muted-foreground text-sm'>
                        全会期で共通の部署を管理します。
                    </p>
                </div>
                <Button size='sm' onClick={openAdd}>
                    + 追加
                </Button>
            </div>

            {infoMessage && (
                <p
                    role='status'
                    className='mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-800 text-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                >
                    {infoMessage}
                </p>
            )}

            {error && formMode === 'idle' && (
                <p
                    role='alert'
                    className='mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                >
                    {error}
                </p>
            )}

            {formMode !== 'idle' && (
                <AdminFormContainer
                    title={
                        formMode === 'adding'
                            ? '新しい部署を追加'
                            : '部署を編集'
                    }
                    onClose={closeForm}
                    isPending={isPending}
                    error={error}
                >
                    <div>
                        <Label htmlFor='department-name'>
                            部署名
                            <span className='ml-1 text-red-500'>*</span>
                        </Label>
                        <Input
                            id='department-name'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='例: 企画部'
                            className='mt-1'
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                if (
                                    (e.nativeEvent as KeyboardEvent).isComposing
                                ) {
                                    // IME 変換確定 Enter のみ無視
                                    return;
                                }
                                e.preventDefault();
                                handleSubmit();
                            }}
                        />
                    </div>
                    <div className='mt-4 flex gap-2'>
                        <Button
                            size='sm'
                            onClick={handleSubmit}
                            disabled={isPending}
                        >
                            {isPending ? '保存中...' : '保存'}
                        </Button>
                        <Button
                            size='sm'
                            variant='outline'
                            onClick={closeForm}
                            disabled={isPending}
                        >
                            キャンセル
                        </Button>
                    </div>
                </AdminFormContainer>
            )}

            {departmentList.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されている部署はありません
                </p>
            ) : (
                <div className='space-y-2'>
                    {departmentList.map((dept) => (
                        <div
                            key={dept.id}
                            className='flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm'
                        >
                            <span className='font-medium text-foreground text-sm'>
                                {dept.name}
                            </span>
                            <div className='flex shrink-0 gap-1'>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => openEdit(dept)}
                                >
                                    編集
                                </Button>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => handleDelete(dept)}
                                    disabled={isPending}
                                    className='text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
                                >
                                    削除
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
