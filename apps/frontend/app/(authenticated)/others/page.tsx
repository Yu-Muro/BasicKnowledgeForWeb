import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    buildContentFetchHeaders,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import OtherItemAdminPanel from './OtherItemAdminPanel';

type OtherItem = {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    displayOrder: number;
};

async function fetchOtherItems(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<OtherItem[]> {
    try {
        const res = await fetchFromBackend('/api/others', {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { items: OtherItem[] };
        return data.items ?? [];
    } catch {
        return [];
    }
}

export default async function OthersPage({
    searchParams,
}: {
    searchParams: Promise<{ event_id?: string }>;
}) {
    const { event_id } = await searchParams;
    const { eventId, authToken, accessToken, role } =
        await resolveAuth(event_id);

    if (!eventId) {
        return (
            <section aria-labelledby='others-heading'>
                <h1
                    id='others-heading'
                    className='mb-4 font-semibold text-foreground text-xl tracking-tight'
                >
                    その他の情報
                </h1>
                <p className='text-muted-foreground text-sm'>
                    会期が選択されていません
                </p>
            </section>
        );
    }

    const items = await fetchOtherItems(eventId, authToken, accessToken, role);
    const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder);

    if (['admin', 'user'].includes(role)) {
        return <OtherItemAdminPanel items={sorted} eventId={eventId} />;
    }

    return (
        <section aria-labelledby='others-heading'>
            <div className='mb-6'>
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
            {sorted.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されているその他の情報はありません
                </p>
            ) : (
                <div className='space-y-4'>
                    {sorted.map((item) => {
                        const imageUrl = item.imageUrl?.trim() ?? '';
                        return (
                            <article
                                key={item.id}
                                className='rounded-xl border border-border bg-card p-4 shadow-sm'
                                aria-labelledby={`other-item-${item.id}`}
                            >
                                <div className='pb-3'>
                                    <h2
                                        id={`other-item-${item.id}`}
                                        className='font-semibold text-foreground text-sm'
                                    >
                                        {item.title}
                                    </h2>
                                </div>
                                <div className='border-border/70 border-t pt-3'>
                                    {imageUrl && (
                                        <div className='mb-3 h-40 w-full overflow-hidden rounded-lg'>
                                            <TapToZoomImage
                                                src={imageUrl}
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
                        );
                    })}
                </div>
            )}
        </section>
    );
}
