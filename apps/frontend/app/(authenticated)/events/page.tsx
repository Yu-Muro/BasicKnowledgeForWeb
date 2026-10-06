import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    buildContentFetchHeaders,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import TapToZoomImage from '@frontend/components/TapToZoomImage';
import { Clock3, MapPin } from 'lucide-react';
import ProgramAdminPanel from './ProgramAdminPanel';

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

type ScheduleDescription = {
    dateLabel: string;
    rangeLabel: string;
};

async function fetchPrograms(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<Program[]> {
    try {
        const res = await fetchFromBackend('/api/programs', {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { programs: Program[] };
        return data.programs ?? [];
    } catch {
        return [];
    }
}

function describeSchedule(
    startIso: string,
    endIso: string,
): ScheduleDescription {
    const start = new Date(startIso);
    const end = new Date(endIso);

    const isStartValid = !Number.isNaN(start.valueOf());
    const isEndValid = !Number.isNaN(end.valueOf());

    if (!isStartValid || !isEndValid) {
        return { dateLabel: '日時未定', rangeLabel: '' };
    }

    const dateLabel = dayFormatter.format(start);
    const rangeLabel = `${timeFormatter.format(start)} 〜 ${timeFormatter.format(end)}`;

    return { dateLabel, rangeLabel };
}

export default async function EventsPage({
    searchParams,
}: {
    searchParams: Promise<{ event_id?: string }>;
}) {
    const { event_id } = await searchParams;
    const { eventId, authToken, accessToken, role } =
        await resolveAuth(event_id);

    if (!eventId) {
        return (
            <div>
                <h1 className='mb-6 font-semibold text-foreground text-xl tracking-tight'>
                    企画一覧
                </h1>
                <p className='text-muted-foreground text-sm'>
                    会期が選択されていません
                </p>
            </div>
        );
    }

    const programs = await fetchPrograms(eventId, authToken, accessToken, role);

    if (['admin', 'user'].includes(role)) {
        return <ProgramAdminPanel items={programs} eventId={eventId} />;
    }

    const sorted = [...programs].sort(
        (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    return (
        <div>
            <h1 className='mb-6 font-semibold text-foreground text-xl tracking-tight'>
                企画一覧
            </h1>
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
                                <p className='font-semibold text-foreground text-sm leading-tight'>
                                    {program.name}
                                </p>
                                <p className='mt-3 flex items-center gap-2 text-muted-foreground text-xs'>
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
