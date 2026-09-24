'use client';

import {
    createTimetableItemAction,
    deleteTimetableItemAction,
    updateTimetableItemAction,
} from '@frontend/app/actions/timetable';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { AdminFormContainer } from '@frontend/components/AdminFormContainer';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const DISPLAY_TIMEZONE = 'Asia/Tokyo';

type TimetableItem = {
    id: string;
    title: string;
    startTime: string;
    location: string;
    description: string | null;
};

async function fetchTimetableItemsFromApi(
    eventId: string,
): Promise<TimetableItem[] | null> {
    try {
        const res = await fetchFromBackend('/api/timetable', {
            credentials: 'include',
            headers: { 'x-event-id': eventId },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { items?: TimetableItem[] };
        return Array.isArray(body.items) ? body.items : null;
    } catch {
        return null;
    }
}

type FormData = {
    title: string;
    start_time: string;
    location: string;
    description: string;
};

const EMPTY_FORM: FormData = {
    title: '',
    start_time: '',
    location: '',
    description: '',
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
        location: item.location,
        description: item.description ?? '',
    };
}

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: DISPLAY_TIMEZONE,
});
const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
});

type TimetableGroup = {
    date: string;
    entries: (TimetableItem & { dateLabel: string; timeLabel: string })[];
};

function buildGroups(items: TimetableItem[]): TimetableGroup[] {
    const sorted = [...items].sort(
        (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    const map = new Map<string, TimetableGroup['entries']>();
    for (const item of sorted) {
        const start = new Date(item.startTime);
        const dateLabel = dateFormatter.format(start);
        const timeLabel = timeFormatter.format(start);
        const entry = { ...item, dateLabel, timeLabel };
        const list = map.get(dateLabel) ?? [];
        list.push(entry);
        map.set(dateLabel, list);
    }
    return Array.from(map.entries()).map(([date, entries]) => ({
        date,
        entries,
    }));
}

type Props = { items: TimetableItem[]; eventId: string };

export default function TimetableAdminPanel({
    items: initialItems,
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

    const handleSubmit = () => {
        const title = formData.title.trim();
        const location = formData.location.trim();
        if (!title || !formData.start_time) {
            setError('タイトル・開始は必須です');
            return;
        }

        const start_time = new Date(formData.start_time).toISOString();

        const description = formData.description.trim() || null;

        startTransition(async () => {
            const result =
                formMode === 'editing' && editingItem
                    ? await updateTimetableItemAction(eventId, editingItem.id, {
                          title,
                          start_time,
                          location,
                          description,
                      })
                    : await createTimetableItemAction(eventId, {
                          title,
                          start_time,
                          location,
                          description,
                      });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setInfoMessage(
                formMode === 'adding'
                    ? 'タイムテーブルを追加しました'
                    : 'タイムテーブルを更新しました',
            );
            const refreshed = await fetchTimetableItemsFromApi(eventId);
            setItems(refreshed ?? result.data);
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
            const refreshed = await fetchTimetableItemsFromApi(eventId);
            setItems(refreshed ?? result.data);
            setInfoMessage('タイムテーブルを削除しました');
            router.refresh();
        });
    };

    const groups = buildGroups(items);

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
                            ? '新しいアイテムを追加'
                            : 'アイテムを編集'
                    }
                >
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

            {groups.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されているタイムテーブルはありません
                </p>
            ) : (
                <div className='space-y-6'>
                    {groups.map(({ date, entries }) => (
                        <section key={date}>
                            <p className='mb-2 font-medium text-muted-foreground text-xs'>
                                {date}
                            </p>
                            <div className='space-y-2'>
                                {entries.map((item) => (
                                    <article
                                        key={item.id}
                                        className='rounded-lg border border-border bg-card p-4'
                                    >
                                        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4'>
                                            <p className='font-medium text-muted-foreground text-xs tabular-nums sm:w-36 sm:flex-none sm:text-sm'>
                                                {item.timeLabel}
                                            </p>
                                            <div className='flex-1 space-y-1'>
                                                <p className='font-semibold text-base text-foreground leading-tight sm:font-medium sm:text-sm'>
                                                    {item.title}
                                                </p>
                                                {item.location && (
                                                    <p className='flex items-center gap-1 text-muted-foreground text-xs'>
                                                        <span aria-hidden='true'>
                                                            {'📍'}
                                                        </span>
                                                        <span>
                                                            {item.location}
                                                        </span>
                                                    </p>
                                                )}
                                                {item.description && (
                                                    <p className='text-muted-foreground text-xs'>
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className='flex shrink-0 gap-1'>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    onClick={() =>
                                                        openEdit(item)
                                                    }
                                                    disabled={isPending}
                                                >
                                                    編集
                                                </Button>
                                                <Button
                                                    size='sm'
                                                    variant='outline'
                                                    onClick={() =>
                                                        handleDelete(item)
                                                    }
                                                    disabled={isPending}
                                                    className='text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
                                                >
                                                    削除
                                                </Button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
