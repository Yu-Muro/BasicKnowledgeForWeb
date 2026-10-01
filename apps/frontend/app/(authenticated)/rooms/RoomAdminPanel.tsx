'use client';

import {
    createRoomAction,
    deleteRoomAction,
    updateRoomAction,
} from '@frontend/app/actions/rooms';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { AdminFormContainer } from '@frontend/components/AdminFormContainer';
import { Button } from '@frontend/components/ui/button';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

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

async function fetchRoomsFromApi(
    eventId: string,
): Promise<RoomWithDepartments[] | null> {
    try {
        const res = await fetchFromBackend('/api/rooms', {
            credentials: 'include',
            headers: { 'x-event-id': eventId },
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { rooms?: RoomWithDepartments[] };
        return Array.isArray(body.rooms) ? body.rooms : null;
    } catch {
        return null;
    }
}

type FormData = {
    building_name: string;
    floor: string;
    room_name: string;
    day_manager_id: string;
    day_purpose: string;
    pre_day_manager_id: string;
    pre_day_purpose: string;
    notes: string;
};

const EMPTY_FORM: FormData = {
    building_name: '',
    floor: '',
    room_name: '',
    day_manager_id: '',
    day_purpose: '',
    pre_day_manager_id: '',
    pre_day_purpose: '',
    notes: '',
};

function itemToForm(item: RoomWithDepartments): FormData {
    return {
        building_name: item.buildingName,
        floor: item.floor,
        room_name: item.roomName,
        day_manager_id: item.dayManagerId,
        day_purpose: item.dayPurpose,
        pre_day_manager_id: item.preDayManagerId ?? '',
        pre_day_purpose: item.preDayPurpose ?? '',
        notes: item.notes ?? '',
    };
}

type Department = { id: string; name: string };

type Props = {
    rooms: RoomWithDepartments[];
    departments: Department[];
    eventId: string;
};

export default function RoomAdminPanel({
    rooms: initialRooms,
    departments,
    eventId,
}: Props) {
    const router = useRouter();
    const [rooms, setRooms] = useState(initialRooms);
    useEffect(() => {
        setRooms(initialRooms);
    }, [initialRooms]);
    const [formMode, setFormMode] = useState<'idle' | 'adding' | 'editing'>(
        'idle',
    );
    const [editingItem, setEditingItem] = useState<RoomWithDepartments | null>(
        null,
    );
    const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const openAdd = () => {
        setFormData(EMPTY_FORM);
        setEditingItem(null);
        setError(null);
        setInfoMessage(null);
        setFormMode('adding');
    };

    const openEdit = (item: RoomWithDepartments) => {
        setFormData(itemToForm(item));
        setEditingItem(item);
        setError(null);
        setInfoMessage(null);
        setFormMode('editing');
    };

    const closeForm = () => {
        setFormMode('idle');
        setEditingItem(null);
        setError(null);
    };

    const handleSubmit = () => {
        const building_name = formData.building_name.trim();
        const floor = formData.floor.trim();
        const room_name = formData.room_name.trim();
        const day_manager_id = formData.day_manager_id.trim();
        const day_purpose = formData.day_purpose.trim();

        if (
            !building_name ||
            !floor ||
            !room_name ||
            !day_manager_id ||
            !day_purpose
        ) {
            setError('建物名・階・部屋名・当日担当部署・当日用途は必須です');
            return;
        }

        const pre_day_manager_id = formData.pre_day_manager_id.trim() || null;
        const pre_day_purpose = formData.pre_day_purpose.trim() || null;
        const notes = formData.notes.trim() || null;

        startTransition(async () => {
            const result =
                formMode === 'editing' && editingItem
                    ? await updateRoomAction(eventId, editingItem.id, {
                          building_name,
                          floor,
                          room_name,
                          day_manager_id,
                          day_purpose,
                          pre_day_manager_id,
                          pre_day_purpose,
                          notes,
                      })
                    : await createRoomAction(eventId, {
                          building_name,
                          floor,
                          room_name,
                          day_manager_id,
                          day_purpose,
                          pre_day_manager_id,
                          pre_day_purpose,
                          notes,
                      });

            if (!result.success) {
                setError(result.error);
                return;
            }

            const refreshed = await fetchRoomsFromApi(eventId);
            setRooms(refreshed ?? result.data);
            setInfoMessage(
                formMode === 'adding'
                    ? '部屋割りを追加しました'
                    : '部屋割りを更新しました',
            );
            router.refresh();
            closeForm();
        });
    };

    const handleDelete = (item: RoomWithDepartments) => {
        if (!confirm(`「${item.roomName}」を削除しますか？`)) return;
        startTransition(async () => {
            const result = await deleteRoomAction(eventId, item.id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            const refreshed = await fetchRoomsFromApi(eventId);
            setRooms(refreshed ?? result.data);
            setInfoMessage('部屋割りを削除しました');
            router.refresh();
        });
    };

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
            <div className='mb-6 flex items-center justify-between'>
                <h1 className='font-semibold text-foreground text-xl tracking-tight'>
                    部屋割り
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
                            ? '新しい部屋割りを追加'
                            : '部屋割りを編集'
                    }
                >
                    <div className='space-y-3'>
                        <div className='grid grid-cols-3 gap-3'>
                            <div>
                                <Label htmlFor='room-building'>
                                    建物名
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='room-building'
                                    value={formData.building_name}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            building_name: e.target.value,
                                        }))
                                    }
                                    placeholder='例: A棟'
                                    className='mt-1'
                                />
                            </div>
                            <div>
                                <Label htmlFor='room-floor'>
                                    階
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='room-floor'
                                    value={formData.floor}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            floor: e.target.value,
                                        }))
                                    }
                                    placeholder='例: 3F'
                                    className='mt-1'
                                />
                            </div>
                            <div>
                                <Label htmlFor='room-name'>
                                    部屋名
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='room-name'
                                    value={formData.room_name}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            room_name: e.target.value,
                                        }))
                                    }
                                    placeholder='例: 301'
                                    className='mt-1'
                                />
                            </div>
                        </div>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <Label htmlFor='room-day-mgr'>
                                    当日担当部署
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <select
                                    id='room-day-mgr'
                                    value={formData.day_manager_id}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            day_manager_id: e.target.value,
                                        }))
                                    }
                                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                                >
                                    <option value=''>部署を選択</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label htmlFor='room-day-purpose'>
                                    当日用途
                                    <span className='ml-1 text-red-500'>*</span>
                                </Label>
                                <Input
                                    id='room-day-purpose'
                                    value={formData.day_purpose}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            day_purpose: e.target.value,
                                        }))
                                    }
                                    placeholder='例: 展示会場'
                                    className='mt-1'
                                />
                            </div>
                        </div>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <Label htmlFor='room-pre-mgr'>
                                    前日担当部署（任意）
                                </Label>
                                <select
                                    id='room-pre-mgr'
                                    value={formData.pre_day_manager_id}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            pre_day_manager_id: e.target.value,
                                        }))
                                    }
                                    className='mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                                >
                                    <option value=''>（なし）</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label htmlFor='room-pre-purpose'>
                                    前日用途（任意）
                                </Label>
                                <Input
                                    id='room-pre-purpose'
                                    value={formData.pre_day_purpose}
                                    onChange={(e) =>
                                        setFormData((f) => ({
                                            ...f,
                                            pre_day_purpose: e.target.value,
                                        }))
                                    }
                                    placeholder='例: 準備作業'
                                    className='mt-1'
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor='room-notes'>備考（任意）</Label>
                            <Input
                                id='room-notes'
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData((f) => ({
                                        ...f,
                                        notes: e.target.value,
                                    }))
                                }
                                placeholder='任意の備考'
                                className='mt-1'
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
                                    <th className='px-4 py-3 font-medium' />
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
                                            <td className='px-4 py-3 align-top'>
                                                <div className='flex gap-1'>
                                                    <Button
                                                        size='sm'
                                                        variant='outline'
                                                        onClick={() =>
                                                            openEdit(room)
                                                        }
                                                        disabled={isPending}
                                                    >
                                                        編集
                                                    </Button>
                                                    <Button
                                                        size='sm'
                                                        variant='outline'
                                                        onClick={() =>
                                                            handleDelete(room)
                                                        }
                                                        disabled={isPending}
                                                        className='text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
                                                    >
                                                        削除
                                                    </Button>
                                                </div>
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
                                    <div className='flex items-start justify-between gap-2'>
                                        <div>
                                            <p className='font-medium text-base text-foreground'>
                                                {room.roomName}
                                            </p>
                                            <span className='text-muted-foreground text-xs'>
                                                {locationLabel}
                                            </span>
                                        </div>
                                        <div className='flex gap-1'>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                onClick={() => openEdit(room)}
                                                disabled={isPending}
                                            >
                                                編集
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='outline'
                                                onClick={() =>
                                                    handleDelete(room)
                                                }
                                                disabled={isPending}
                                                className='text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40'
                                            >
                                                削除
                                            </Button>
                                        </div>
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
