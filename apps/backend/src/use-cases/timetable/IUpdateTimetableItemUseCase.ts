import type { TimetableItem } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';

export type UpdateTimetableItemInput = {
    id: string;
    eventId: string;
    payload: {
        title?: string;
        startTime?: string;
        endTime?: string;
        location?: string;
        description?: string | null;
        isPublic?: boolean;
        departmentIds?: string[];
    };
};

export type UpdateTimetableItemResult =
    | { success: true; data: TimetableItem }
    | { success: false; error: string; status?: number };

export interface IUpdateTimetableItemUseCase {
    execute(
        input: UpdateTimetableItemInput,
    ): Promise<UpdateTimetableItemResult>;
}
