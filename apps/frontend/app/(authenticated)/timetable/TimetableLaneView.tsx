'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

const DISPLAY_TIMEZONE = 'Asia/Tokyo';
const PUBLIC_LANE_ID = 'public';

export type TimetableDepartment = {
    id: string;
    name: string;
};

export type TimetableItem = {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string | null;
    isPublic: boolean;
    departments: TimetableDepartment[];
};

type Lane = {
    id: string;
    name: string;
    type: 'public' | 'department';
};

type TimetableViewItem = TimetableItem & {
    dateLabel: string;
    timeLabel: string;
    rangeLabel: string;
};

type TimetableGroup = {
    date: string;
    entries: TimetableViewItem[];
    timeLabels: string[];
};

type Props = {
    items: TimetableItem[];
    departments: TimetableDepartment[];
    eventId: string;
    renderActions?: (item: TimetableItem) => ReactNode;
};

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
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

function buildLanes(departments: TimetableDepartment[]): Lane[] {
    return [
        { id: PUBLIC_LANE_ID, name: '全体向け', type: 'public' },
        ...departments.map((department) => ({
            id: department.id,
            name: department.name,
            type: 'department' as const,
        })),
    ];
}

function formatItem(item: TimetableItem): TimetableViewItem {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime ?? item.startTime);
    const startLabel = timeFormatter.format(start);
    const endLabel = timeFormatter.format(end);
    const startDateLabel = dateFormatter.format(start);
    const endDateLabel = dateFormatter.format(end);
    return {
        ...item,
        dateLabel: startDateLabel,
        timeLabel: startLabel,
        rangeLabel:
            startDateLabel !== endDateLabel
                ? `${startLabel} - ${endDateLabel} ${endLabel}`
                : startLabel === endLabel
                  ? startLabel
                  : `${startLabel} - ${endLabel}`,
    };
}

function buildGroups(items: TimetableItem[]): TimetableGroup[] {
    const sorted = [...items].sort(
        (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    const map = new Map<string, TimetableViewItem[]>();
    for (const item of sorted.map(formatItem)) {
        const next = map.get(item.dateLabel) ?? [];
        next.push(item);
        map.set(item.dateLabel, next);
    }

    return Array.from(map.entries()).map(([date, entries]) => ({
        date,
        entries,
        timeLabels: Array.from(new Set(entries.map((item) => item.timeLabel))),
    }));
}

function getInitialLaneIds(items: TimetableItem[], lanes: Lane[]): string[] {
    if (items.some((item) => item.isPublic)) return [PUBLIC_LANE_ID];
    const firstUsedDepartment = items
        .flatMap((item) => item.departments)
        .find((department) =>
            lanes.some(
                (lane) =>
                    lane.type === 'department' && lane.id === department.id,
            ),
        );
    return firstUsedDepartment ? [firstUsedDepartment.id] : [];
}

function getStoredLaneIds(
    storageKey: string,
    items: TimetableItem[],
    lanes: Lane[],
): string[] {
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored) return getInitialLaneIds(items, lanes);

        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) return getInitialLaneIds(items, lanes);

        const laneIds = parsed.filter(
            (value): value is string =>
                typeof value === 'string' &&
                lanes.some((lane) => lane.id === value),
        );
        return parsed.length > 0 && laneIds.length === 0
            ? getInitialLaneIds(items, lanes)
            : laneIds;
    } catch {
        return getInitialLaneIds(items, lanes);
    }
}

function storeLaneIds(storageKey: string, laneIds: string[]): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(laneIds));
    } catch {
        // Storage is optional; the in-memory selection remains usable.
    }
}

function itemBelongsToLane(item: TimetableItem, lane: Lane): boolean {
    if (lane.type === 'public') return item.isPublic;
    return item.departments.some((department) => department.id === lane.id);
}

export default function TimetableLaneView({
    items,
    departments,
    eventId,
    renderActions,
}: Props) {
    const lanes = useMemo(() => buildLanes(departments), [departments]);
    const [selectedLaneIds, setSelectedLaneIds] = useState<string[]>(() =>
        getInitialLaneIds(items, lanes),
    );
    const storageKey = `timetable:lanes:${eventId}`;

    useEffect(() => {
        setSelectedLaneIds(getStoredLaneIds(storageKey, items, lanes));
    }, [items, lanes, storageKey]);

    useEffect(() => {
        storeLaneIds(storageKey, selectedLaneIds);
    }, [selectedLaneIds, storageKey]);

    const selectedLanes = lanes.filter((lane) =>
        selectedLaneIds.includes(lane.id),
    );
    const visibleItems = items.filter((item) =>
        selectedLanes.some((lane) => itemBelongsToLane(item, lane)),
    );
    const groups = buildGroups(visibleItems);

    const toggleLane = (laneId: string) => {
        setSelectedLaneIds((current) =>
            current.includes(laneId)
                ? current.filter((id) => id !== laneId)
                : [...current, laneId],
        );
    };

    return (
        <div className='space-y-5'>
            <div>
                <p className='mb-2 font-medium text-muted-foreground text-xs'>
                    表示列
                </p>
                <div className='flex flex-wrap gap-2'>
                    {lanes.map((lane) => (
                        <label
                            key={lane.id}
                            className='inline-flex min-h-8 items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm'
                        >
                            <input
                                type='checkbox'
                                checked={selectedLaneIds.includes(lane.id)}
                                onChange={() => toggleLane(lane.id)}
                            />
                            <span>{lane.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {selectedLanes.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    表示する列を選択してください
                </p>
            ) : groups.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    選択した列に予定はありません
                </p>
            ) : (
                <div className='space-y-6'>
                    {groups.map((group) => (
                        <section key={group.date} aria-label={group.date}>
                            <p className='mb-2 font-medium text-muted-foreground text-xs'>
                                {group.date}
                            </p>
                            <div className='overflow-x-auto rounded-lg border border-border'>
                                <div
                                    className='grid min-w-max bg-card'
                                    style={{
                                        gridTemplateColumns: `4.5rem repeat(${selectedLanes.length}, minmax(14rem, 1fr))`,
                                    }}
                                >
                                    <div className='sticky left-0 z-10 border-border border-r bg-muted px-3 py-2 font-medium text-muted-foreground text-xs'>
                                        時刻
                                    </div>
                                    {selectedLanes.map((lane) => (
                                        <div
                                            key={lane.id}
                                            className='border-border border-r px-3 py-2 font-semibold text-foreground text-sm last:border-r-0'
                                        >
                                            {lane.name}
                                        </div>
                                    ))}

                                    {group.timeLabels.map((timeLabel) => (
                                        <LaneRow
                                            key={`${group.date}-${timeLabel}`}
                                            timeLabel={timeLabel}
                                            entries={group.entries.filter(
                                                (item) =>
                                                    item.timeLabel ===
                                                    timeLabel,
                                            )}
                                            lanes={selectedLanes}
                                            renderActions={renderActions}
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

function LaneRow({
    timeLabel,
    entries,
    lanes,
    renderActions,
}: {
    timeLabel: string;
    entries: TimetableViewItem[];
    lanes: Lane[];
    renderActions?: (item: TimetableItem) => ReactNode;
}) {
    return (
        <>
            <div className='sticky left-0 z-10 border-border border-t border-r bg-card px-3 py-3 font-medium text-muted-foreground text-xs tabular-nums'>
                {timeLabel}
            </div>
            {lanes.map((lane) => {
                const laneItems = entries.filter((item) =>
                    itemBelongsToLane(item, lane),
                );
                return (
                    <div
                        key={`${timeLabel}-${lane.id}`}
                        className='min-h-24 space-y-2 border-border border-t border-r p-2 last:border-r-0'
                    >
                        {laneItems.map((item) => (
                            <article
                                key={`${lane.id}-${item.id}`}
                                className='rounded-md border border-primary/20 bg-primary/10 p-3'
                            >
                                <div className='mb-1 flex items-start justify-between gap-2'>
                                    <p className='font-medium text-foreground text-sm leading-tight'>
                                        {item.title}
                                    </p>
                                    <span className='shrink-0 text-muted-foreground text-xs tabular-nums'>
                                        {item.rangeLabel}
                                    </span>
                                </div>
                                {item.location && (
                                    <p className='text-muted-foreground text-xs'>
                                        {item.location}
                                    </p>
                                )}
                                {item.description && (
                                    <p className='mt-1 text-muted-foreground text-xs'>
                                        {item.description}
                                    </p>
                                )}
                                <div className='mt-2 flex flex-wrap gap-1'>
                                    {item.isPublic && (
                                        <span className='rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground text-xs'>
                                            全体
                                        </span>
                                    )}
                                    {item.departments.map((department) => (
                                        <span
                                            key={department.id}
                                            className='rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground text-xs'
                                        >
                                            {department.name}
                                        </span>
                                    ))}
                                </div>
                                {renderActions && (
                                    <div className='mt-3 flex gap-1'>
                                        {renderActions(item)}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                );
            })}
        </>
    );
}
