'use client';

import type { AccessCode as BackendAccessCode } from '@backend/src/infrastructure/repositories/access-code/IAccessCodeRepository';
import {
    copyDepartmentsFromEventAction,
    createDepartmentAction,
    deleteDepartmentAction,
    updateDepartmentAction,
} from '@frontend/app/actions/departments';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { client } from '@frontend/app/utils/client';
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

type AccessCode = Pick<BackendAccessCode, 'id' | 'eventName'>;

async function fetchDepartmentsFromApi(
    eventId: string,
): Promise<Department[] | null> {
    try {
        const res = await fetchFromBackend('/api/departments', {
            credentials: 'include',
            headers: { 'x-event-id': eventId },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { departments?: Department[] };
        return Array.isArray(body.departments) ? body.departments : null;
    } catch {
        return null;
    }
}

async function fetchAccessCodesFromApi(): Promise<AccessCode[] | null> {
    try {
        const res = await client.api['access-codes'].$get();
        if (!res.ok) return null;
        const body = await res.json();
        if (!('codes' in body) || !Array.isArray(body.codes)) return null;
        return body.codes;
    } catch {
        return null;
    }
}

type Props = { departments: Department[]; eventId: string };

export default function DepartmentAdminPanel({ departments, eventId }: Props) {
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
    const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
    const [copySourceEventId, setCopySourceEventId] = useState('');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        let isMounted = true;
        (async () => {
            const codes = await fetchAccessCodesFromApi();
            if (!codes || !isMounted) return;
            setAccessCodes(codes.filter((code) => code.id !== eventId));
        })();
        return () => {
            isMounted = false;
        };
    }, [eventId]);

    const openAdd = () => {
        setName('');
        setEditingItem(null);
        setError(null);
        setInfoMessage(null);
        setFormMode('adding');
    };

    const openEdit = (item: Department) => {
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
                    ? await updateDepartmentAction(eventId, editingItem.id, {
                          name: trimmed,
                      })
                    : await createDepartmentAction(eventId, { name: trimmed });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setInfoMessage(
                formMode === 'adding'
                    ? '部署を追加しました'
                    : '部署を更新しました',
            );
            const refreshed = await fetchDepartmentsFromApi(eventId);
            setDepartmentList(refreshed ?? result.data);
            router.refresh();
            closeForm();
        });
    };

    const handleDelete = (item: Department) => {
        if (!confirm(`「${item.name}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteDepartmentAction(eventId, item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setInfoMessage('部署を削除しました');
            const refreshed = await fetchDepartmentsFromApi(eventId);
            setDepartmentList(refreshed ?? result.data);
            router.refresh();
        });
    };

    const handleCopyDepartments = () => {
        setError(null);
        setInfoMessage(null);
        if (!copySourceEventId) {
            setError('コピー元会期を選択してください');
            return;
        }

        startTransition(async () => {
            const result = await copyDepartmentsFromEventAction(
                eventId,
                copySourceEventId,
            );
            if (!result.success) {
                setError(result.error);
                return;
            }

            setInfoMessage('過去会期から部署をコピーしました');
            const refreshed = await fetchDepartmentsFromApi(eventId);
            setDepartmentList(refreshed ?? result.data);
            setCopySourceEventId('');
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
                        イベントに参加する部署を管理します。
                    </p>
                </div>
                {formMode === 'idle' && (
                    <Button size='sm' onClick={openAdd}>
                        + 追加
                    </Button>
                )}
            </div>

            <div className='mb-6 rounded-xl border border-border bg-card p-4 shadow-sm'>
                <h2 className='mb-2 font-medium text-foreground text-sm'>
                    過去会期からコピー
                </h2>
                <p className='mb-3 text-muted-foreground text-xs'>
                    選択した会期の部署名を、現在の会期へ一括追加します。
                </p>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                    <select
                        aria-label='コピー元会期'
                        value={copySourceEventId}
                        disabled={isPending || accessCodes.length === 0}
                        onChange={(e) => setCopySourceEventId(e.target.value)}
                        className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:max-w-md'
                    >
                        <option value=''>コピー元会期を選択</option>
                        {accessCodes.map((code) => (
                            <option key={code.id} value={code.id}>
                                {code.eventName}
                            </option>
                        ))}
                    </select>
                    <Button
                        size='sm'
                        variant='outline'
                        onClick={handleCopyDepartments}
                        disabled={isPending || accessCodes.length === 0}
                    >
                        {isPending ? 'コピー中...' : 'コピーして追加'}
                    </Button>
                </div>
                {accessCodes.length === 0 && (
                    <p className='mt-2 text-muted-foreground text-xs'>
                        コピー可能な過去会期がありません
                    </p>
                )}
            </div>

            {infoMessage && (
                <p
                    role='status'
                    className='mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-emerald-800 text-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                >
                    {infoMessage}
                </p>
            )}

            {error && formMode !== 'editing' && (
                <p
                    role='alert'
                    className='mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                >
                    {error}
                </p>
            )}

            {formMode !== 'idle' && (
                <AdminFormContainer
                    editing={formMode === 'editing'}
                    error={error}
                    isPending={isPending}
                    onClose={closeForm}
                    title={
                        formMode === 'adding'
                            ? '新しい部署を追加'
                            : '部署を編集'
                    }
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
                                    disabled={isPending}
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
