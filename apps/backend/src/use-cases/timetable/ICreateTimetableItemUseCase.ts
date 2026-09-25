import type { TimetableItem } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';

export type CreateTimetableItemInput = {
    eventId: string;
    title: string;
    startTime: string;
    endTime?: string;
    location?: string;
    description?: string | null;
    isPublic?: boolean;
    departmentIds?: string[];
};

export type CreateTimetableItemResult =
    | { success: true; data: TimetableItem }
    | { success: false; error: string; status?: number };

export interface ICreateTimetableItemUseCase {
    execute(
        input: CreateTimetableItemInput,
    ): Promise<CreateTimetableItemResult>;
}
