import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    buildContentFetchHeaders,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import Link from 'next/link';

const NAV_CARDS = [
    {
        href: '/timetable',
        label: 'タイムテーブル',
        description: '当日のスケジュール',
    },
    {
        href: '/rooms',
        label: '部屋割り',
        description: '会場・スペース割り当て',
    },
    { href: '/events', label: '企画一覧', description: '企画と詳細情報' },
    { href: '/shop', label: '販売物一覧', description: '頒布物・価格情報' },
    { href: '/others', label: '情報', description: 'その他のお知らせ' },
    {
        href: '/search',
        label: '検索',
        description: '全カテゴリからキーワード検索',
    },
] as const;

type AccessCode = {
    id: string;
    eventName: string;
};

async function fetchEventName(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<string | null> {
    try {
        const res = await fetchFromBackend(`/api/access-codes/${eventId}`, {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { code?: AccessCode };
        return data.code?.eventName ?? null;
    } catch {
        return null;
    }
}

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ event_id?: string }>;
}) {
    const { event_id } = await searchParams;
    const { eventId, authToken, accessToken, role } = await resolveAuth(
        event_id,
        { allowAccessFallback: true },
    );

    const eventName = eventId
        ? await fetchEventName(eventId, authToken, accessToken, role)
        : null;
    const isPrivileged = role === 'admin';

    const eventQuery = event_id
        ? new URLSearchParams({ event_id }).toString()
        : '';
    const buildHref = (href: string) =>
        eventQuery ? `${href}?${eventQuery}` : href;

    return (
        <div className='space-y-8'>
            <section className='space-y-2'>
                <p className='font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]'>
                    Staff Home
                </p>
                <h1 className='font-semibold text-2xl text-foreground tracking-tight sm:text-3xl'>
                    {eventName ? `ようこそ、${eventName}へ` : 'ようこそ'}
                </h1>
                {isPrivileged && !eventName && (
                    <p className='text-muted-foreground text-sm'>
                        会期を選択すると入口ページを表示できます
                    </p>
                )}
            </section>

            <section
                aria-label='トップナビゲーション'
                className='grid grid-cols-2 gap-3 sm:grid-cols-3'
            >
                {NAV_CARDS.map(({ href, label, description }) => (
                    <Link
                        key={href}
                        href={buildHref(href)}
                        className='group flex min-h-28 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md'
                    >
                        <span className='font-medium text-base text-foreground'>
                            {label}
                        </span>
                        <span className='text-muted-foreground text-xs leading-5'>
                            {description}
                        </span>
                    </Link>
                ))}
            </section>
        </div>
    );
}
