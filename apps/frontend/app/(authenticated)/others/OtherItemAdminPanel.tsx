'use client';

import {
    createOtherItemAction,
    deleteOtherItemAction,
    updateOtherItemAction,
} from '@frontend/app/actions/others';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { uploadImage } from '@frontend/app/lib/imageUpload';
import { AdminFormContainer } from '@frontend/components/AdminFormContainer';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

type OtherItem = {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    displayOrder: number;
};

async function fetchOtherItemsFromApi(
    eventId: string,
): Promise<OtherItem[] | null> {
    try {
        const res = await fetchFromBackend('/api/others', {
            credentials: 'include',
            headers: { 'x-event-id': eventId },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { items?: OtherItem[] };
        return Array.isArray(body.items) ? body.items : null;
    } catch {
        return null;
    }
}

type FormData = {
    title: string;
    content: string;
    display_order: string;
};

const EMPTY_FORM: FormData = { title: '', content: '', display_order: '0' };

function itemToForm(item: OtherItem): FormData {
    return {
        title: item.title,
        content: item.content,
        display_order: String(item.displayOrder),
    };
}

type Props = { items: OtherItem[]; eventId: string };

export default function OtherItemAdminPanel({
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
    const [editingItem, setEditingItem] = useState<OtherItem | null>(null);
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

    const openEdit = (item: OtherItem) => {
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

        const result = await uploadImage('/api/others/upload', eventId, file);
        if (!result.success) {
            throw new Error(result.error);
        }

        return result.imageKey;
    };

    const handleSubmit = () => {
        const title = formData.title.trim();
        const content = formData.content.trim();
        const display_order = Number(formData.display_order);
        if (!title || !content) {
            setError('タイトルと内容は必須です');
            return;
        }
        if (Number.isNaN(display_order)) {
            setError('表示順は数値で入力してください');
            return;
        }

        startTransition(async () => {
            try {
                const imageKey = await uploadImageIfSelected();

                const result =
                    formMode === 'editing' && editingItem
                        ? await updateOtherItemAction(eventId, editingItem.id, {
                              title,
                              content,
                              display_order,
                              ...(imageKey ? { image_key: imageKey } : {}),
                          })
                        : await createOtherItemAction(eventId, {
                              title,
                              content,
                              display_order,
                              ...(imageKey ? { image_key: imageKey } : {}),
                          });

                if (!result.success) {
                    setError(result.error);
                    return;
                }

                const refreshed = await fetchOtherItemsFromApi(eventId);
                setItems(refreshed ?? result.data);
                setInfoMessage(
                    formMode === 'adding'
                        ? '情報を追加しました'
                        : '情報を更新しました',
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

    const handleDelete = (item: OtherItem) => {
        if (!confirm(`「${item.title}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteOtherItemAction(eventId, item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            const refreshed = await fetchOtherItemsFromApi(eventId);
            setItems(refreshed ?? result.data);
            setInfoMessage('情報を削除しました');
            router.refresh();
        });
    };

    const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder);

    return (
        <section aria-labelledby='others-heading'>
            <div className='mb-6 flex items-center justify-between'>
                <div>
                    <h1
                        id='others-heading'
                        className='font-semibold text-foreground text-xl tracking-tight'
                    >
                        その他の情報
                    </h1>
                    <p className='mt-2 text-muted-foreground text-sm'>
                        注意事項や連絡先など、自由記述の共有事項を閲覧できます。
                    </p>
                </div>
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
                            ? '新しい情報を追加'
                            : '情報を編集'
                    }
                >
                    <div className='space-y-3'>
                        <div>
                            <Label htmlFor='other-title'>
                                タイトル
                                <span className='ml-1 text-red-500'>*</span>
                            </Label>
                            <Input
                                id='other-title'
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        title: e.target.value,
                                    }))
                                }
                                placeholder='例: 緊急連絡先'
                                className='mt-1'
                            />
                        </div>
                        <div>
                            <Label htmlFor='other-content'>
                                内容
                                <span className='ml-1 text-red-500'>*</span>
                            </Label>
                            <textarea
                                id='other-content'
                                value={formData.content}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        content: e.target.value,
                                    }))
                                }
                                placeholder='内容を入力してください'
                                rows={4}
                                className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                            />
                        </div>
                        <div>
                            <Label htmlFor='other-image'>
                                画像ファイル（任意）
                                {formMode === 'editing' && (
                                    <span className='ml-1 text-muted-foreground text-xs'>
                                        （変更する場合のみ選択）
                                    </span>
                                )}
                            </Label>
                            <input
                                ref={fileInputRef}
                                id='other-image'
                                type='file'
                                accept='image/*'
                                className='mt-1 w-full text-muted-foreground text-sm file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:font-medium file:text-sm hover:file:bg-muted/80'
                            />
                        </div>
                        <div>
                            <Label htmlFor='other-order'>表示順</Label>
                            <Input
                                id='other-order'
                                type='number'
                                value={formData.display_order}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        display_order: e.target.value,
                                    }))
                                }
                                className='mt-1 w-32'
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
                    登録されているその他の情報はありません
                </p>
            ) : (
                <div className='space-y-4'>
                    {sorted.map((item) => (
                        <article
                            key={item.id}
                            className='rounded-xl border border-border bg-card p-4 shadow-sm'
                            aria-labelledby={`other-item-${item.id}`}
                        >
                            <div className='flex items-start justify-between gap-2 pb-3'>
                                <h2
                                    id={`other-item-${item.id}`}
                                    className='font-semibold text-foreground text-sm'
                                >
                                    {item.title}
                                </h2>
                                <div className='flex shrink-0 gap-1'>
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
                                </div>
                            </div>
                            <div className='border-border/70 border-t pt-3'>
                                {item.imageUrl?.trim() && (
                                    <div className='mb-3 h-40 w-full overflow-hidden rounded-lg'>
                                        <TapToZoomImage
                                            src={item.imageUrl.trim()}
                                            alt={item.title}
                                            sizes='(max-width: 768px) 100vw, 400px'
                                        />
                                    </div>
                                )}
                                <p className='whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed'>
                                    {item.content}
                                </p>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
