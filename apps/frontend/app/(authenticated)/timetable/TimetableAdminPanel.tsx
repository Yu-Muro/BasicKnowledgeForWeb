'use client';

import {
    createTimetableItemAction,
    deleteTimetableItemAction,
    updateTimetableItemAction,
} from '@frontend/app/actions/timetable';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import TimetableLaneView, {
    type TimetableDepartment,
    type TimetableItem,
} from './TimetableLaneView';

type FormData = {
    title: string;
    start_time: string;
    end_time: string;
    location: string;
    description: string;
    is_public: boolean;
    department_ids: string[];
};

const EMPTY_FORM: FormData = {
    title: '',
    start_time: '',
    end_time: '',
    location: '',
    description: '',
    is_public: true,
    department_ids: [],
};

function isoToDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
}

function itemToForm(item: TimetableItem): FormData {
    return {
        title: item.title,
        start_time: isoToDatetimeLocal(item.startTime),
        end_time: isoToDatetimeLocal(item.endTime ?? item.startTime),
        location: item.location,
        description: item.description ?? '',
        is_public: item.isPublic,
        department_ids: item.departments.map((department) => department.id),
    };
}

type Props = {
    items: TimetableItem[];
    departments: TimetableDepartment[];
    eventId: string;
};

export default function TimetableAdminPanel({
    items: initialItems,
    departments,
    eventId,
}: Props) {
    const router = useRouter();
    const [items, setItems] = useState(initialItems);
    useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);
    const [formMode, setFormMode] = useState<'idle' | 'adding' | 'editing'>(
        'idle',
    );
    const [editingItem, setEditingItem] = useState<TimetableItem | null>(null);
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const openAdd = () => {
        setFormData(EMPTY_FORM);
        setEditingItem(null);
        setError(null);
        setInfoMessage(null);
        setFormMode('adding');
    };

    const openEdit = (item: TimetableItem) => {
        setFormData(itemToForm(item));
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

    const toggleDepartment = (departmentId: string) => {
        setFormData((current) => ({
            ...current,
            department_ids: current.department_ids.includes(departmentId)
                ? current.department_ids.filter((id) => id !== departmentId)
                : [...current.department_ids, departmentId],
        }));
    };

    const handleSubmit = () => {
        const title = formData.title.trim();
        const location = formData.location.trim();
        if (!title || !formData.start_time || !formData.end_time) {
            setError('タイトル・開始・終了は必須です');
            return;
        }

        const start = new Date(formData.start_time);
        const end = new Date(formData.end_time);
        if (start > end) {
            setError('終了時刻は開始時刻以降にしてください');
            return;
        }
        if (!formData.is_public && formData.department_ids.length === 0) {
            setError('全体向けまたは部署タグを1つ以上選択してください');
            return;
        }

        const payload = {
            title,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            location,
            description: formData.description.trim() || null,
            is_public: formData.is_public,
            department_ids: formData.department_ids,
        };

        startTransition(async () => {
            const result =
                formMode === 'editing' && editingItem
                    ? await updateTimetableItemAction(
                          eventId,
                          editingItem.id,
                          payload,
                      )
                    : await createTimetableItemAction(eventId, payload);

            if (!result.success) {
                setError(result.error);
                return;
            }

            setInfoMessage(
                formMode === 'adding'
                    ? 'タイムテーブルを追加しました'
                    : 'タイムテーブルを更新しました',
            );
            setItems(result.data);
            router.refresh();
            closeForm();
        });
    };

    const handleDelete = (item: TimetableItem) => {
        if (!confirm(`「${item.title}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteTimetableItemAction(eventId, item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setItems(result.data);
            setInfoMessage('タイムテーブルを削除しました');
            router.refresh();
        });
    };

    return (
        <div>
            <div className='mb-6 flex items-center justify-between'>
                <h1 className='font-semibold text-foreground text-xl tracking-tight'>
                    タイムテーブル
                </h1>
                {formMode === 'idle' && (
                    <Button size='sm' onClick={openAdd}>
                        + 追加
                    </Button>
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

            {error && (
                <p
                    role='alert'
                    className='mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                >
                    {error}
                </p>
            )}

            {formMode !== 'idle' && (
                <div className='mb-6 rounded-lg border border-border bg-card p-4 shadow-sm'>
                    <h2 className='mb-4 font-medium text-foreground text-sm'>
                        {formMode === 'adding'
                            ? '新しいアイテムを追加'
                            : 'アイテムを編集'}
                    </h2>
                    <div className='space-y-3'>
                        <div>
                            <Label htmlFor='tt-title'>
                                タイトル
                                <span className='ml-1 text-red-500'>*</span>
                            </Label>
                            <Input
                                id='tt-title'
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        title: e.target.value,
                                    }))
                                }
                                placeholder='例: 開会式'
                                className='mt-1'
                            />
                        </div>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <div>
                                <Label htmlFor='tt-start'>
                                    開始時刻
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='tt-start'
                                    type='datetime-local'
                                    value={formData.start_time}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            start_time: e.target.value,
                                        }))
                                    }
                                    className='mt-1'
                                />
                            </div>
                            <div>
                                <Label htmlFor='tt-end'>
                                    終了時刻
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='tt-end'
                                    type='datetime-local'
                                    value={formData.end_time}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            end_time: e.target.value,
                                        }))
                                    }
                                    className='mt-1'
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor='tt-location'>場所</Label>
                            <Input
                                id='tt-location'
                                value={formData.location}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        location: e.target.value,
                                    }))
                                }
                                placeholder='例: 大ホール'
                                className='mt-1'
                            />
                        </div>
                        <div>
                            <Label htmlFor='tt-desc'>説明（任意）</Label>
                            <Input
                                id='tt-desc'
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        description: e.target.value,
                                    }))
                                }
                                placeholder='任意のメモ'
                                className='mt-1'
                            />
                        </div>
                        <div className='space-y-2'>
                            <label className='inline-flex min-h-8 items-center gap-2 text-sm'>
                                <input
                                    type='checkbox'
                                    checked={formData.is_public}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            is_public: e.target.checked,
                                        }))
                                    }
                                />
                                <span>全体向けに表示</span>
                            </label>
                            <div>
                                <p className='mb-2 font-medium text-sm'>
                                    部署タグ
                                </p>
                                {departments.length === 0 ? (
                                    <p className='text-muted-foreground text-sm'>
                                        登録済み部署はありません
                                    </p>
                                ) : (
                                    <div className='flex flex-wrap gap-2'>
                                        {departments.map((department) => (
                                            <label
                                                key={department.id}
                                                className='inline-flex min-h-8 items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm'
                                            >
                                                <input
                                                    type='checkbox'
                                                    checked={formData.department_ids.includes(
                                                        department.id,
                                                    )}
                                                    onChange={() =>
                                                        toggleDepartment(
                                                            department.id,
                                                        )
                                                    }
                                                />
                                                <span>{department.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
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
                </div>
            )}

            {items.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されているタイムテーブルはありません
                </p>
            ) : (
                <TimetableLaneView
                    items={items}
                    departments={departments}
                    eventId={eventId}
                    renderActions={(item) => (
                        <>
                            <Button
                                size='sm'
                                variant='outline'
                                onClick={() => openEdit(item)}
                                disabled={isPending}
                            >
                                編集
                            </Button>
                            <Button
                                size='sm'
                                variant='outline'
                                onClick={() => handleDelete(item)}
                                disabled={isPending}
                                className='text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
                            >
                                削除
                            </Button>
                        </>
                    )}
                />
            )}
        </div>
    );
}
