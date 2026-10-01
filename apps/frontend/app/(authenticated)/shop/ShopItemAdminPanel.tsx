'use client';

import {
    createShopItemAction,
    deleteShopItemAction,
    updateShopItemAction,
} from '@frontend/app/actions/shop-items';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { uploadImage } from '@frontend/app/lib/imageUpload';
import { AdminFormContainer } from '@frontend/components/AdminFormContainer';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { useRouter } from 'next/navigation';
import {
    type CSSProperties,
    useEffect,
    useRef,
    useState,
    useTransition,
} from 'react';

type ShopItem = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    imageUrl: string;
};

async function fetchShopItemsFromApi(
    eventId: string,
): Promise<ShopItem[] | null> {
    try {
        const res = await fetchFromBackend('/api/shop-items', {
            credentials: 'include',
            headers: { 'x-event-id': eventId },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { items?: ShopItem[] };
        return Array.isArray(body.items) ? body.items : null;
    } catch {
        return null;
    }
}

type FormData = {
    name: string;
    price: string;
    description: string;
};

const EMPTY_FORM: FormData = {
    name: '',
    price: '0',
    description: '',
};

function itemToForm(item: ShopItem): FormData {
    return {
        name: item.name,
        price: String(item.price),
        description: item.description ?? '',
    };
}

const priceFormatter = new Intl.NumberFormat('ja-JP');

function ShopItemImage({
    item,
    className = '',
    aspectRatio,
}: {
    item: ShopItem;
    className?: string;
    aspectRatio?: string;
}) {
    const sanitizedUrl = item.imageUrl.trim();
    const hasImage = sanitizedUrl.length > 0;
    const style: CSSProperties | undefined = aspectRatio
        ? { aspectRatio }
        : undefined;

    return (
        <div
            className={`relative overflow-hidden rounded-lg bg-muted ${className}`}
            style={style}
        >
            {hasImage ? (
                <TapToZoomImage
                    src={sanitizedUrl}
                    alt={item.name}
                    sizes='(max-width: 768px) 100vw, 160px'
                    thumbnailClassName='object-cover'
                />
            ) : (
                <div className='flex h-full w-full items-center justify-center text-[10px] text-muted-foreground uppercase tracking-wide'>
                    No Image
                </div>
            )}
        </div>
    );
}

type Props = { items: ShopItem[]; eventId: string };

export default function ShopItemAdminPanel({
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
    const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
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
    };

    const openEdit = (item: ShopItem) => {
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

        const result = await uploadImage(
            '/api/shop-items/upload',
            eventId,
            file,
        );
        if (!result.success) {
            throw new Error(result.error);
        }

        return result.imageKey;
    };

    const handleSubmit = () => {
        const name = formData.name.trim();
        const price = Number(formData.price);

        if (!name) {
            setError('商品名は必須です');
            return;
        }
        if (Number.isNaN(price) || price < 0) {
            setError('価格は0以上の数値で入力してください');
            return;
        }

        const isAdding = formMode === 'adding';
        const file = fileInputRef.current?.files?.[0];

        if (isAdding && !file) {
            setError('新規追加時は画像が必須です');
            return;
        }

        const description = formData.description.trim() || null;

        startTransition(async () => {
            try {
                const imageKey = await uploadImageIfSelected();

                if (formMode === 'editing' && editingItem) {
                    const updateData: Parameters<
                        typeof updateShopItemAction
                    >[2] = {
                        name,
                        price,
                        description,
                    };
                    if (imageKey) updateData.image_key = imageKey;

                    const result = await updateShopItemAction(
                        eventId,
                        editingItem.id,
                        updateData,
                    );
                    if (!result.success) {
                        setError(result.error);
                        return;
                    }
                    const refreshed = await fetchShopItemsFromApi(eventId);
                    setItems(refreshed ?? result.data);
                } else {
                    const result = await createShopItemAction(eventId, {
                        name,
                        price,
                        image_key: imageKey!,
                        description,
                    });
                    if (!result.success) {
                        setError(result.error);
                        return;
                    }
                    const refreshed = await fetchShopItemsFromApi(eventId);
                    setItems(refreshed ?? result.data);
                }
                setInfoMessage(
                    formMode === 'adding'
                        ? '販売物を追加しました'
                        : '販売物を更新しました',
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

    const handleDelete = (item: ShopItem) => {
        if (!confirm(`「${item.name}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteShopItemAction(eventId, item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            const refreshed = await fetchShopItemsFromApi(eventId);
            setItems(refreshed ?? result.data);
            setInfoMessage('販売物を削除しました');
            router.refresh();
        });
    };

    const sorted = [...items].sort((a, b) =>
        a.name.localeCompare(b.name, 'ja'),
    );

    return (
        <div>
            <div className='mb-6 flex items-center justify-between'>
                <h1 className='font-semibold text-foreground text-xl tracking-tight'>
                    販売物一覧
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
                            ? '新しい販売物を追加'
                            : '販売物を編集'
                    }
                >
                    <div className='space-y-3'>
                        <div>
                            <Label htmlFor='shop-name'>
                                商品名
                                <span className='ml-1 text-red-500'>*</span>
                            </Label>
                            <Input
                                id='shop-name'
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder='例: オリジナルTシャツ'
                                className='mt-1'
                            />
                        </div>
                        <div>
                            <div>
                                <Label htmlFor='shop-price'>
                                    価格（円）
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='shop-price'
                                    type='number'
                                    min={0}
                                    value={formData.price}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            price: e.target.value,
                                        }))
                                    }
                                    className='mt-1'
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor='shop-image'>
                                画像ファイル
                                {formMode === 'adding' && (
                                    <span className='ml-1 text-red-500'>*</span>
                                )}
                                {formMode === 'editing' && (
                                    <span className='ml-1 text-muted-foreground text-xs'>
                                        （変更する場合のみ選択）
                                    </span>
                                )}
                            </Label>
                            <input
                                ref={fileInputRef}
                                id='shop-image'
                                type='file'
                                accept='image/*'
                                className='mt-1 w-full text-muted-foreground text-sm file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:font-medium file:text-sm hover:file:bg-muted/80'
                            />
                        </div>
                        <div>
                            <Label htmlFor='shop-desc'>説明（任意）</Label>
                            <textarea
                                id='shop-desc'
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
                    登録されている販売物はありません
                </p>
            ) : (
                <div className='space-y-6'>
                    <div className='hidden overflow-x-auto rounded-xl border border-border md:block'>
                        <table
                            className='min-w-full divide-y divide-border text-sm'
                            aria-label='販売物一覧'
                        >
                            <thead className='bg-muted/40 text-left text-muted-foreground text-xs uppercase tracking-wide'>
                                <tr>
                                    <th className='px-4 py-3 font-medium'>
                                        画像
                                    </th>
                                    <th className='px-4 py-3 font-medium'>
                                        商品名
                                    </th>
                                    <th className='px-4 py-3 font-medium'>
                                        価格
                                    </th>
                                    <th className='px-4 py-3 font-medium'>
                                        説明
                                    </th>
                                    <th className='px-4 py-3 font-medium' />
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-border bg-card text-foreground'>
                                {sorted.map((item) => (
                                    <tr key={item.id}>
                                        <td className='px-4 py-3 align-top'>
                                            <ShopItemImage
                                                item={item}
                                                className='h-20 w-20'
                                                aspectRatio='1 / 1'
                                            />
                                        </td>
                                        <td className='px-4 py-3 align-top font-medium'>
                                            {item.name}
                                        </td>
                                        <td className='px-4 py-3 align-top tabular-nums'>
                                            ¥{priceFormatter.format(item.price)}
                                        </td>
                                        <td className='whitespace-pre-wrap px-4 py-3 align-top text-muted-foreground text-xs'>
                                            {item.description ?? '—'}
                                        </td>
                                        <td className='px-4 py-3 align-top'>
                                            <div className='flex gap-1'>
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
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className='space-y-3 md:hidden'>
                        {sorted.map((item) => (
                            <article
                                key={item.id}
                                className='rounded-xl border border-border bg-card p-4'
                            >
                                <ShopItemImage
                                    item={item}
                                    className='mb-3 w-full'
                                    aspectRatio='4 / 3'
                                />
                                <div className='flex items-start justify-between gap-2'>
                                    <div className='flex-1'>
                                        <p className='font-medium text-base text-foreground'>
                                            {item.name}
                                        </p>
                                        <p className='mt-2 font-semibold text-foreground tabular-nums'>
                                            ¥{priceFormatter.format(item.price)}
                                        </p>
                                        {item.description && (
                                            <p className='mt-3 whitespace-pre-wrap text-muted-foreground text-sm'>
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className='mt-3 flex gap-1'>
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
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
