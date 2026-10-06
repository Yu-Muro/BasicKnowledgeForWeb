'use client';

import type { SearchResultData } from '@backend/src/use-cases/search/ISearchUseCase';
import { useAuthContext } from '@frontend/app/(authenticated)/auth-context';
import { client } from '@frontend/app/utils/client';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

type Serialize<T> = T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialize<U>[]
      : T extends object
        ? { [K in keyof T]: Serialize<T[K]> }
        : T;

type SearchResponse = Serialize<SearchResultData>;

type TimetableResult = SearchResponse['timetable'][number];
type RoomResult = SearchResponse['rooms'][number];
type ProgramResult = SearchResponse['programs'][number];
type ShopItemResult = SearchResponse['shopItems'][number];
type OtherItemResult = SearchResponse['otherItems'][number];

const DISPLAY_TIMEZONE = 'Asia/Tokyo';

const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
});

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: DISPLAY_TIMEZONE,
});

function formatRange(startIso: string, endIso: string) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

function formatTime(iso: string) {
    return timeFormatter.format(new Date(iso));
}

function formatDateLabel(iso: string) {
    return dateFormatter.format(new Date(iso));
}

function hasText(value: string) {
    return value.trim().length > 0;
}

function toImageUrl(value: string | null | undefined) {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function SearchPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname() ?? '/search';
    const { role, userEventId } = useAuthContext();

    const isPrivileged = ['admin', 'user'].includes(role);
    const queryParam = searchParams?.get('q') ?? '';
    const adminEventId = searchParams?.get('event_id') ?? null;
    const resolvedEventId = isPrivileged ? adminEventId : userEventId;
    const trimmedQuery = queryParam.trim();

    const [inputValue, setInputValue] = useState(queryParam);
    const [results, setResults] = useState<SearchResponse | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setInputValue(queryParam);
    }, [queryParam]);

    useEffect(() => {
        if (!trimmedQuery || !resolvedEventId) {
            setResults(null);
            setStatus('idle');
            setErrorMessage(null);
            return;
        }

        let cancelled = false;

        setResults(null);
        setStatus('loading');
        setErrorMessage(null);

        client.api.search
            .$get({
                query: { q: trimmedQuery },
                header: { 'x-event-id': resolvedEventId },
            })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('検索に失敗しました');
                }
                return (await response.json()) as SearchResponse;
            })
            .then((data) => {
                if (!cancelled) {
                    setResults(data);
                    setStatus('idle');
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setResults(null);
                    setStatus('error');
                    setErrorMessage('検索に失敗しました');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [trimmedQuery, resolvedEventId]);

    const canSubmit = Boolean(resolvedEventId && inputValue.trim().length >= 1);

    const pathnameWithFallback = pathname || '/search';

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = inputValue.trim();
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        if (trimmed) {
            params.set('q', trimmed);
        } else {
            params.delete('q');
        }
        const queryString = params.toString();
        router.replace(
            `${pathnameWithFallback}${queryString ? `?${queryString}` : ''}`,
        );
    };

    const sections = useMemo(
        () => [
            {
                key: 'timetable',
                label: 'タイムテーブル',
                items: results?.timetable ?? [],
                render: (item: TimetableResult) => (
                    <article
                        key={item.id}
                        className='rounded-lg border border-border bg-card p-4'
                    >
                        <p className='font-semibold text-base text-foreground leading-tight'>
                            {item.title}
                        </p>
                        <div className='mt-1 text-muted-foreground text-sm'>
                            <span>{formatDateLabel(item.startTime)}</span>
                            <span className='mx-2'>・</span>
                            <span>{formatTime(item.startTime)}</span>
                        </div>
                        {hasText(item.location) && (
                            <p className='mt-1 text-muted-foreground text-sm'>
                                📍 {item.location}
                            </p>
                        )}
                        {item.description && (
                            <p className='mt-2 text-muted-foreground text-sm'>
                                {item.description}
                            </p>
                        )}
                    </article>
                ),
            },
            {
                key: 'rooms',
                label: '部屋割り',
                items: results?.rooms ?? [],
                render: (room: RoomResult) => (
                    <article
                        key={room.id}
                        className='rounded-lg border border-border bg-card p-4'
                    >
                        <p className='font-semibold text-base text-foreground'>
                            {room.buildingName}・{room.floor} {room.roomName}
                        </p>
                        <p className='mt-2 text-muted-foreground text-sm'>
                            当日: {room.dayManagerName} — {room.dayPurpose}
                        </p>
                        {room.preDayManagerName && room.preDayPurpose && (
                            <p className='text-muted-foreground text-sm'>
                                前日: {room.preDayManagerName} —{' '}
                                {room.preDayPurpose}
                            </p>
                        )}
                        {room.notes && (
                            <p className='mt-2 text-muted-foreground text-sm'>
                                備考: {room.notes}
                            </p>
                        )}
                    </article>
                ),
            },
            {
                key: 'programs',
                label: '企画',
                items: results?.programs ?? [],
                render: (program: ProgramResult) => {
                    const imageUrl = toImageUrl(program.imageUrl);
                    return (
                        <article
                            key={program.id}
                            className='rounded-lg border border-border bg-card p-4'
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
                            <p className='font-semibold text-base text-foreground'>
                                {program.name}
                            </p>
                            <p className='mt-1 text-muted-foreground text-sm'>
                                {formatDateLabel(program.startTime)} ・{' '}
                                {formatRange(
                                    program.startTime,
                                    program.endTime,
                                )}
                            </p>
                            {hasText(program.location) && (
                                <p className='mt-1 text-muted-foreground text-sm'>
                                    📍 {program.location}
                                </p>
                            )}
                            {program.description && (
                                <p className='mt-2 text-muted-foreground text-sm'>
                                    {program.description}
                                </p>
                            )}
                        </article>
                    );
                },
            },
            {
                key: 'shopItems',
                label: '販売物',
                items: results?.shopItems ?? [],
                render: (item: ShopItemResult) => {
                    const imageUrl = toImageUrl(item.imageUrl);
                    return (
                        <article
                            key={item.id}
                            className='rounded-lg border border-border bg-card p-4'
                        >
                            {imageUrl && (
                                <div className='mb-3 h-36 w-full overflow-hidden rounded-lg'>
                                    <TapToZoomImage
                                        src={imageUrl}
                                        alt={item.name}
                                        sizes='(max-width: 768px) 100vw, 360px'
                                    />
                                </div>
                            )}
                            <p className='font-semibold text-base text-foreground'>
                                {item.name}
                            </p>
                            <p className='mt-2 font-semibold text-foreground tabular-nums'>
                                ¥{item.price.toLocaleString('ja-JP')}
                            </p>
                            {item.description && (
                                <p className='mt-2 text-muted-foreground text-sm'>
                                    {item.description}
                                </p>
                            )}
                        </article>
                    );
                },
            },
            {
                key: 'otherItems',
                label: 'その他情報',
                items: results?.otherItems ?? [],
                render: (info: OtherItemResult) => {
                    const imageUrl = toImageUrl(info.imageUrl);
                    return (
                        <article
                            key={info.id}
                            className='rounded-lg border border-border bg-card p-4'
                        >
                            {imageUrl && (
                                <div className='mb-3 h-40 w-full overflow-hidden rounded-lg'>
                                    <TapToZoomImage
                                        src={imageUrl}
                                        alt={info.title}
                                        sizes='(max-width: 768px) 100vw, 400px'
                                    />
                                </div>
                            )}
                            <p className='font-semibold text-base text-foreground'>
                                {info.title}
                            </p>
                            <p className='mt-2 whitespace-pre-wrap text-muted-foreground text-sm'>
                                {info.content}
                            </p>
                        </article>
                    );
                },
            },
        ],
        [results],
    );

    const hasResults = sections.some((section) => section.items.length > 0);

    const eventNotice = !resolvedEventId
        ? isPrivileged
            ? '会期を選択すると検索できます'
            : '会期が選択されていません'
        : null;

    const keywordNotice =
        trimmedQuery.length === 0
            ? 'キーワードを入力して検索してください'
            : null;

    return (
        <div className='space-y-8'>
            <div className='space-y-2'>
                <p className='font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]'>
                    Search
                </p>
                <h1 className='font-semibold text-2xl text-foreground tracking-tight sm:text-3xl'>
                    検索
                </h1>
                <p className='text-muted-foreground text-sm'>
                    タイムテーブル・部屋割り・企画・販売物・その他の情報を横断検索できます。
                </p>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='flex flex-col gap-3 md:flex-row md:items-center'>
                    <input
                        type='text'
                        name='q'
                        placeholder='キーワードを入力'
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        className='flex-1 rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
                        aria-label='検索キーワード'
                    />
                    <button
                        type='submit'
                        className='rounded-lg bg-foreground px-6 py-3 font-semibold text-background text-base transition-opacity disabled:opacity-50'
                        disabled={!canSubmit}
                    >
                        検索
                    </button>
                </div>
                {eventNotice && (
                    <p className='text-muted-foreground text-sm'>
                        {eventNotice}
                    </p>
                )}
            </form>

            {status === 'loading' && (
                <p className='text-muted-foreground text-sm'>検索中です…</p>
            )}
            {status === 'error' && errorMessage && (
                <p className='text-destructive text-sm'>{errorMessage}</p>
            )}
            {!resolvedEventId && (
                <p className='text-muted-foreground text-sm'>
                    会期を選択してから検索を実行してください。
                </p>
            )}
            {resolvedEventId && keywordNotice && (
                <p className='text-muted-foreground text-sm'>{keywordNotice}</p>
            )}

            {resolvedEventId &&
                queryParam.trim() &&
                !hasResults &&
                status === 'idle' && (
                    <p className='text-muted-foreground text-sm'>
                        該当する情報が見つかりません
                    </p>
                )}

            <div className='space-y-8'>
                {sections
                    .filter((section) => section.items.length > 0)
                    .map((section) => (
                        <section key={section.key} className='space-y-3'>
                            <div className='flex items-center justify-between'>
                                <h2 className='font-semibold text-foreground text-lg'>
                                    {section.label}
                                </h2>
                                <span className='text-muted-foreground text-sm'>
                                    {section.items.length}件
                                </span>
                            </div>
                            <div className='space-y-3'>
                                {section.items.map((item) =>
                                    section.render(item as never),
                                )}
                            </div>
                        </section>
                    ))}
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense
            fallback={
                <p className='text-muted-foreground text-sm'>
                    検索条件を読み込み中…
                </p>
            }
        >
            <SearchPageContent />
        </Suspense>
    );
}
