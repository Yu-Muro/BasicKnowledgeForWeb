'use client';

import {
    createProgramAction,
    deleteProgramAction,
    updateProgramAction,
    uploadProgramImageAction,
} from '@frontend/app/actions/programs';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { AdminFormContainer } from '@frontend/components/AdminFormContainer';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { Clock3, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

const DISPLAY_TIMEZONE = 'Asia/Tokyo';

type Program = {
    id: string;
    name: string;
    location: string;
    startTime: string;
    endTime: string;
    description: string | null;
    imageUrl: string | null;
};

async function fetchProgramsFromApi(
    eventId: string,
): Promise<Program[] | null> {
    try {
        const res = await fetchFromBackend('/api/programs', {
            credentials: 'include',
            headers: { 'x-event-id': eventId },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { programs?: Program[] };
        return Array.isArray(body.programs) ? body.programs : null;
    } catch {
        return null;
    }
}

type FormData = {
    name: string;
    location: string;
    start_time: string;
    end_time: string;
    description: string;
};

const EMPTY_FORM: FormData = {
    name: '',
    location: '',
    start_time: '',
    end_time: '',
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

function itemToForm(item: Program): FormData {
    return {
        name: item.name,
        location: item.location,
        start_time: isoToDatetimeLocal(item.startTime),
        end_time: isoToDatetimeLocal(item.endTime),
        description: item.description ?? '',
    };
}

const dayFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
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

function describeSchedule(startIso: string, endIso: string) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
        return { dateLabel: '日時未定', rangeLabel: '' };
    }
    return {
        dateLabel: dayFormatter.format(start),
        rangeLabel: `${timeFormatter.format(start)} 〜 ${timeFormatter.format(end)}`,
    };
}

type Props = { items: Program[]; eventId: string };

export default function ProgramAdminPanel({
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
    const [editingItem, setEditingItem] = useState<Program | null>(null);
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openAdd = () => {
        setFormData(EMPTY_FORM);
        setEditingItem(null);
        setError(null);
        setInfoMessage(null);
        setFormMode('adding');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const openEdit = (item: Program) => {
        setFormData(itemToForm(item));
        setEditingItem(item);
        setError(null);
        setInfoMessage(null);
        setFormMode('editing');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const closeForm = () => {
        setFormMode('idle');
        setEditingItem(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const uploadImageIfSelected = async (): Promise<string | null> => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);

        const result = await uploadProgramImageAction(eventId, formData);
        if (!result.success) {
            throw new Error(result.error);
        }

        return result.imageKey;
    };

    const handleSubmit = () => {
        const name = formData.name.trim();
        const location = formData.location.trim();
        if (!name || !formData.start_time || !formData.end_time || !location) {
            setError('名前・開始・終了・場所は必須です');
            return;
        }

        const start_time = new Date(formData.start_time).toISOString();
        const end_time = new Date(formData.end_time).toISOString();

        const description = formData.description.trim() || null;

        startTransition(async () => {
            try {
                const imageKey = await uploadImageIfSelected();

                const result =
                    formMode === 'editing' && editingItem
                        ? await updateProgramAction(eventId, editingItem.id, {
                              name,
                              location,
                              start_time,
                              end_time,
                              description,
                              ...(imageKey ? { image_key: imageKey } : {}),
                          })
                        : await createProgramAction(eventId, {
                              name,
                              location,
                              start_time,
                              end_time,
                              description,
                              ...(imageKey ? { image_key: imageKey } : {}),
                          });

                if (!result.success) {
                    setError(result.error);
                    return;
                }

                const refreshed = await fetchProgramsFromApi(eventId);
                setItems(refreshed ?? result.data);
                setInfoMessage(
                    formMode === 'adding'
                        ? '企画を追加しました'
                        : '企画を更新しました',
                );
                router.refresh();
                closeForm();
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : '操作に失敗しました',
                );
            }
        });
    };

    const handleDelete = (item: Program) => {
        if (!confirm(`「${item.name}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteProgramAction(eventId, item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            const refreshed = await fetchProgramsFromApi(eventId);
            setItems(refreshed ?? result.data);
            setInfoMessage('企画を削除しました');
            router.refresh();
        });
    };

    const sorted = [...items].sort(
        (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    return (
        <div>
            <div className='mb-6 flex items-center justify-between'>
                <h1 className='font-semibold text-foreground text-xl tracking-tight'>
                    企画一覧
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
                            ? '新しい企画を追加'
                            : '企画を編集'
                    }
                >
                    <div className='space-y-3'>
                        <div>
                            <Label htmlFor='prog-name'>
                                企画名
                                <span className='ml-1 text-red-500'>*</span>
                            </Label>
                            <Input
                                id='prog-name'
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder='例: 展示会'
                                className='mt-1'
                            />
                        </div>
                        <div>
                            <Label htmlFor='prog-location'>
                                場所
                                <span className='ml-1 text-red-500'>*</span>
                            </Label>
                            <Input
                                id='prog-location'
                                value={formData.location}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        location: e.target.value,
                                    }))
                                }
                                placeholder='例: A棟3F'
                                className='mt-1'
                            />
                        </div>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <Label htmlFor='prog-start'>
                                    開始時刻
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='prog-start'
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
                                <Label htmlFor='prog-end'>
                                    終了時刻
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='prog-end'
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
                            <Label htmlFor='prog-image'>
                                画像ファイル（任意）
                                {formMode === 'editing' && (
                                    <span className='ml-1 text-muted-foreground text-xs'>
                                        （変更する場合のみ選択）
                                    </span>
                                )}
                            </Label>
                            <input
                                ref={fileInputRef}
                                id='prog-image'
                                type='file'
                                accept='image/*'
                                className='mt-1 w-full text-muted-foreground text-sm file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:font-medium file:text-sm hover:file:bg-muted/80'
                            />
                        </div>
                        <div>
                            <Label htmlFor='prog-desc'>説明（任意）</Label>
                            <textarea
                                id='prog-desc'
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        description: e.target.value,
                                    }))
                                }
                                placeholder='任意のメモ'
                                rows={3}
                                className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
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

            {sorted.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されている企画はありません
                </p>
            ) : (
                <div className='grid gap-4 md:grid-cols-2'>
                    {sorted.map((program) => {
                        const imageUrl = program.imageUrl?.trim() ?? '';
                        const schedule = describeSchedule(
                            program.startTime,
                            program.endTime,
                        );
                        return (
                            <div
                                key={program.id}
                                className='rounded-2xl border border-border bg-card/80 p-5 shadow-sm'
                            >
                                {imageUrl && (
                                    <div className='mb-3 h-40 w-full overflow-hidden rounded-lg'>
                                        <TapToZoomImage
                                            src={imageUrl}
                                            alt={program.name}
                                            sizes='(max-width: 768px) 100vw, 400px'
                                        />
                                    </div>
                                )}
                                <div className='mb-3 flex items-start justify-between gap-2'>
                                    <p className='font-semibold text-foreground text-sm leading-tight'>
                                        {program.name}
                                    </p>
                                    <div className='flex shrink-0 gap-1'>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            onClick={() => openEdit(program)}
                                            disabled={isPending}
                                        >
                                            編集
                                        </Button>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            onClick={() =>
                                                handleDelete(program)
                                            }
                                            disabled={isPending}
                                            className='text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
                                        >
                                            削除
                                        </Button>
                                    </div>
                                </div>
                                <p className='flex items-center gap-2 text-muted-foreground text-xs'>
                                    <MapPin aria-hidden size={14} />
                                    <span>{program.location}</span>
                                </p>
                                <div className='mt-2 flex items-start gap-2 text-muted-foreground text-xs tabular-nums'>
                                    <Clock3
                                        aria-hidden
                                        size={14}
                                        className='mt-0.5 shrink-0'
                                    />
                                    <div>
                                        <p className='text-foreground'>
                                            {schedule.dateLabel}
                                        </p>
                                        <p>{schedule.rangeLabel}</p>
                                    </div>
                                </div>
                                {program.description && (
                                    <p className='mt-4 whitespace-pre-wrap border-border border-t border-dashed pt-3 text-muted-foreground text-xs leading-relaxed'>
                                        {program.description}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
