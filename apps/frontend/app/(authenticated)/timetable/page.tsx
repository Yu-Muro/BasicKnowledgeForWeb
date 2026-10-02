import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    buildContentFetchHeaders,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import TimetableAdminPanel from './TimetableAdminPanel';
import TimetableLaneView, {
    type TimetableDepartment,
    type TimetableItem,
} from './TimetableLaneView';

async function fetchTimetable(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<TimetableItem[]> {
    try {
        const res = await fetchFromBackend('/api/timetable', {
            headers: buildContentFetchHeaders(
                eventId,
                authToken,
                accessToken,
                role,
            ),
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { items: TimetableItem[] };
        return data.items ?? [];
    } catch {
        return [];
    }
}

async function fetchDepartments(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): Promise<TimetableDepartment[]> {
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
        const data = (await res.json()) as {
            departments: TimetableDepartment[];
        };
        return data.departments ?? [];
    } catch {
        return [];
    }
}

function mergeDepartments(
    items: TimetableItem[],
    departments: TimetableDepartment[],
): TimetableDepartment[] {
    const departmentMap = new Map(
        departments.map((department) => [department.id, department]),
    );
    for (const item of items) {
        for (const department of item.departments) {
            if (!departmentMap.has(department.id)) {
                departmentMap.set(department.id, department);
            }
        }
    }
    return Array.from(departmentMap.values());
}

export default async function TimetablePage({
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
                    タイムテーブル
                </h1>
                <p className='text-muted-foreground text-sm'>
                    会期が選択されていません
                </p>
            </div>
        );
    }

    const [items, departments] = await Promise.all([
        fetchTimetable(eventId, authToken, accessToken, role),
        fetchDepartments(eventId, authToken, accessToken, role),
    ]);
    const availableDepartments = mergeDepartments(items, departments);

    if (role === 'admin') {
        return (
            <TimetableAdminPanel
                items={items}
                departments={availableDepartments}
                eventId={eventId}
            />
        );
    }

    return (
        <div>
            <h1 className='mb-6 font-semibold text-foreground text-xl tracking-tight'>
                タイムテーブル
            </h1>
            {items.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    登録されているタイムテーブルはありません
                </p>
            ) : (
                <TimetableLaneView
                    items={items}
                    departments={availableDepartments}
                    eventId={eventId}
                />
            )}
        </div>
    );
}
