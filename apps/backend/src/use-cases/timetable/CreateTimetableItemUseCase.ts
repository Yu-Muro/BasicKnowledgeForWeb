import {
    InvalidTimetableDepartmentIdsError,
    InvalidTimetableLaneSelectionError,
    InvalidTimetableTimeRangeError,
    type ITimetableRepository,
} from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import type {
    CreateTimetableItemInput,
    CreateTimetableItemResult,
    ICreateTimetableItemUseCase,
} from './ICreateTimetableItemUseCase';

export class CreateTimetableItemUseCase implements ICreateTimetableItemUseCase {
    constructor(private readonly timetableRepository: ITimetableRepository) {}

    async execute(
        input: CreateTimetableItemInput,
    ): Promise<CreateTimetableItemResult> {
        const start = new Date(input.startTime);
        const end = new Date(input.endTime ?? input.startTime);
        const isPublic = input.isPublic ?? true;
        const departmentIds = input.departmentIds ?? [];

        if (end < start) {
            return {
                success: false,
                error: '終了時刻は開始時刻以降にしてください',
                status: 400,
            };
        }

        if (!isPublic && departmentIds.length === 0) {
            return {
                success: false,
                error: '全体向けまたは部署タグを1つ以上指定してください',
                status: 400,
            };
        }

        try {
            const data = await this.timetableRepository.create({
                eventId: input.eventId,
                title: input.title,
                startTime: start,
                endTime: end,
                location: input.location ?? '',
                description: input.description ?? null,
                isPublic,
                departmentIds,
            });
            return { success: true, data };
        } catch (error) {
            if (error instanceof InvalidTimetableDepartmentIdsError) {
                return {
                    success: false,
                    error: '指定された部署タグが見つかりません',
                    status: 400,
                };
            }
            if (error instanceof InvalidTimetableLaneSelectionError) {
                return {
                    success: false,
                    error: '全体向けまたは部署タグを1つ以上指定してください',
                    status: 400,
                };
            }
            if (error instanceof InvalidTimetableTimeRangeError) {
                return {
                    success: false,
                    error: '終了時刻は開始時刻以降にしてください',
                    status: 400,
                };
            }
            return {
                success: false,
                error: 'タイムテーブルの作成中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
