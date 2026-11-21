import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    buildContentFetchHeaders,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import type { CSSProperties } from 'react';
import ShopItemAdminPanel from './ShopItemAdminPanel';

type ShopItem = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    imageUrl: string;
};

async function fetchShopItems(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<ShopItem[]> {
    try {
        const res = await fetchFromBackend('/api/shop-items', {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { items: ShopItem[] };
        return data.items ?? [];
    } catch {
        return [];
    }
}

const priceFormatter = new Intl.NumberFormat('ja-JP');

const sortByName = (items: ShopItem[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

type ShopItemImageProps = {
    item: ShopItem;
    className?: string;
    aspectRatio?: string;
};

function ShopItemImage({
    item,
    className = '',
    aspectRatio,
}: ShopItemImageProps) {
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

export default async function ShopPage({
    searchParams,
}: {
    searchParams: Promise<{ event_id?: string }>;
}) {
    const { event_id } = await searchParams;
    const { eventId, authToken, accessToken, role } = await resolveAuth(
        event_id,
        { allowAccessFallback: true },
    );

    if (!eventId) {
        return (
            <div>
                <h1 className='mb-6 font-semibold text-foreground text-xl tracking-tight'>
                    販売物一覧
                </h1>
                <p className='text-muted-foreground text-sm'>
                    会期が選択されていません
                </p>
            </div>
        );
    }

    const rawItems = await fetchShopItems(
        eventId,
        authToken,
        accessToken,
        role,
    );

    if (role === 'admin') {
        return <ShopItemAdminPanel items={rawItems} eventId={eventId} />;
    }

    const items = sortByName(rawItems);
    const hasImageDataIssue = items.some(
        (item) => item.imageUrl.trim().length === 0,
    );

    const renderPrice = (price: number) => `¥${priceFormatter.format(price)}`;

    return (
        <div>
            <h1 className='mb-6 font-semibold text-foreground text-xl tracking-tight'>
                販売物一覧
            </h1>
            {items.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されている販売物はありません
                </p>
            ) : (
                <div className='space-y-6'>
                    {hasImageDataIssue && (
                        <div
                            role='alert'
                            className='rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-amber-900 text-sm shadow-sm dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-50'
                        >
                            データ不備:
                            商品画像が登録されていないアイテムがあります。
                        </div>
                    )}
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
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-border bg-card text-foreground'>
                                {items.map((item) => (
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
                                            {renderPrice(item.price)}
                                        </td>
                                        <td className='whitespace-pre-wrap px-4 py-3 align-top text-muted-foreground text-xs'>
                                            {item.description ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className='space-y-3 md:hidden'>
                        {items.map((item) => (
                            <article
                                key={item.id}
                                className='rounded-xl border border-border bg-card p-4'
                            >
                                <ShopItemImage
                                    item={item}
                                    className='mb-3 w-full'
                                    aspectRatio='4 / 3'
                                />
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='font-medium text-base text-foreground'>
                                        {item.name}
                                    </p>
                                </div>
                                <p className='mt-2 font-semibold text-foreground tabular-nums'>
                                    {renderPrice(item.price)}
                                </p>
                                {item.description && (
                                    <p className='mt-3 whitespace-pre-wrap text-muted-foreground text-sm'>
                                        {item.description}
                                    </p>
                                )}
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
