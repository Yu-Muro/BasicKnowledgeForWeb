import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    buildContentFetchHeaders,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import RoomAdminPanel from './RoomAdminPanel';

type RoomWithDepartments = {
    id: string;
    buildingName: string;
    floor: string;
    roomName: string;
    preDayManagerId: string | null;
    preDayManagerName: string | null;
    preDayPurpose: string | null;
    dayManagerId: string;
    dayManagerName: string;
    dayPurpose: string;
    notes: string | null;
};

type Department = { id: string; name: string };

async function fetchRooms(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<RoomWithDepartments[]> {
    try {
        const res = await fetchFromBackend('/api/rooms', {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { rooms: RoomWithDepartments[] };
        return data.rooms ?? [];
    } catch {
        return [];
    }
}

async function fetchDepartments(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<Department[]> {
    try {
        const res = await fetchFromBackend('/api/departments', {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { departments: Department[] };
        return data.departments ?? [];
    } catch {
        return [];
    }
}

export default async function RoomsPage({
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
                    部屋割り
                </h1>
                <p className='text-muted-foreground text-sm'>
                    会期が選択されていません
                </p>
            </div>
        );
    }

    const [rooms, departments] = await Promise.all([
        fetchRooms(eventId, authToken, accessToken, role),
        fetchDepartments(eventId, authToken, accessToken, role),
    ]);

    if (['admin', 'user'].includes(role)) {
        return (
            <RoomAdminPanel
                rooms={rooms}
                departments={departments}
                eventId={eventId}
            />
        );
    }

    const sorted = [...rooms].sort((a, b) => {
        const buildingDiff = a.buildingName.localeCompare(b.buildingName);
        if (buildingDiff !== 0) return buildingDiff;
        const floorDiff = a.floor.localeCompare(b.floor);
        if (floorDiff !== 0) return floorDiff;
        return a.roomName.localeCompare(b.roomName);
    });

    const renderAssignment = (
        name: string | null,
        purpose: string | null,
        placeholder = '—',
    ) => {
        if (!name) return placeholder;
        return purpose ? `${name} — ${purpose}` : name;
    };

    return (
        <div>
            <h1 className='mb-6 font-semibold text-foreground text-xl tracking-tight'>
                部屋割り
            </h1>
            {sorted.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されている部屋割りはありません
                </p>
            ) : (
                <div className='space-y-6'>
                    <div className='hidden overflow-x-auto rounded-xl border border-border md:block'>
                        <table
                            className='min-w-full divide-y divide-border text-sm'
                            aria-label='部屋割り一覧'
                        >
                            <thead className='bg-muted/40 text-left text-muted-foreground text-xs uppercase tracking-wide'>
                                <tr>
                                    <th className='px-4 py-3 font-medium'>
                                        部屋
                                    </th>
                                    <th className='px-4 py-3 font-medium'>
                                        前日担当
                                    </th>
                                    <th className='px-4 py-3 font-medium'>
                                        当日担当
                                    </th>
                                    <th className='px-4 py-3 font-medium'>
                                        備考
                                    </th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-border bg-card'>
                                {sorted.map((room) => {
                                    const locationLabel = `${room.buildingName}・${room.floor}`;
                                    return (
                                        <tr key={room.id}>
                                            <td className='px-4 py-3 align-top'>
                                                <p className='font-medium text-foreground'>
                                                    {room.roomName}
                                                </p>
                                                <p className='text-muted-foreground text-xs'>
                                                    {locationLabel}
                                                </p>
                                            </td>
                                            <td className='px-4 py-3 align-top text-foreground text-sm'>
                                                {renderAssignment(
                                                    room.preDayManagerName,
                                                    room.preDayPurpose,
                                                )}
                                            </td>
                                            <td className='px-4 py-3 align-top text-foreground text-sm'>
                                                {renderAssignment(
                                                    room.dayManagerName,
                                                    room.dayPurpose,
                                                )}
                                            </td>
                                            <td className='px-4 py-3 align-top text-muted-foreground text-sm'>
                                                {room.notes ?? '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className='space-y-3 md:hidden'>
                        {sorted.map((room) => {
                            const locationLabel = `${room.buildingName}・${room.floor}`;
                            return (
                                <article
                                    key={room.id}
                                    aria-label={`${room.roomName}の割当情報`}
                                    className='rounded-xl border border-border bg-card p-4'
                                >
                                    <div className='flex items-baseline justify-between gap-2'>
                                        <p className='font-medium text-base text-foreground'>
                                            {room.roomName}
                                        </p>
                                        <span className='text-muted-foreground text-xs'>
                                            {locationLabel}
                                        </span>
                                    </div>
                                    {room.preDayManagerName && (
                                        <p className='mt-3 text-foreground text-sm'>
                                            <span className='text-muted-foreground'>
                                                前日:{' '}
                                            </span>
                                            {renderAssignment(
                                                room.preDayManagerName,
                                                room.preDayPurpose,
                                            )}
                                        </p>
                                    )}
                                    <p className='mt-2 text-foreground text-sm'>
                                        <span className='text-muted-foreground'>
                                            当日:{' '}
                                        </span>
                                        {renderAssignment(
                                            room.dayManagerName,
                                            room.dayPurpose,
                                        )}
                                    </p>
                                    {room.notes && (
                                        <p className='mt-2 text-muted-foreground text-sm'>
                                            備考: {room.notes}
                                        </p>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
