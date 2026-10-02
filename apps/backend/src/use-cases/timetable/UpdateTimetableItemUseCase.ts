import type { UpdateTimetableItemInput as RepositoryUpdateTimetableItemInput } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import {
    InvalidTimetableDepartmentIdsError,
    InvalidTimetableLaneSelectionError,
    InvalidTimetableTimeRangeError,
    type ITimetableRepository,
} from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import type {
    IUpdateTimetableItemUseCase,
    UpdateTimetableItemInput,
    UpdateTimetableItemResult,
} from './IUpdateTimetableItemUseCase';

export class UpdateTimetableItemUseCase implements IUpdateTimetableItemUseCase {
    constructor(private readonly timetableRepository: ITimetableRepository) {}

    async execute(
        input: UpdateTimetableItemInput,
    ): Promise<UpdateTimetableItemResult> {
        const updatePayload: RepositoryUpdateTimetableItemInput = {};
        if (input.payload.title !== undefined) {
            updatePayload.title = input.payload.title;
        }
        if (input.payload.startTime !== undefined) {
            updatePayload.startTime = new Date(input.payload.startTime);
        }
        if (input.payload.endTime !== undefined) {
            updatePayload.endTime = new Date(input.payload.endTime);
        }
        if (input.payload.location !== undefined) {
            updatePayload.location = input.payload.location;
        }
        if (input.payload.description !== undefined) {
            updatePayload.description = input.payload.description;
        }
        if (input.payload.isPublic !== undefined) {
            updatePayload.isPublic = input.payload.isPublic;
        }
        if (input.payload.departmentIds !== undefined) {
            updatePayload.departmentIds = input.payload.departmentIds;
        }

        if (Object.keys(updatePayload).length === 0) {
            return {
                success: false,
                error: '更新項目が指定されていません',
                status: 400,
            };
        }

        if (
            updatePayload.startTime !== undefined ||
            updatePayload.endTime !== undefined ||
            updatePayload.isPublic !== undefined ||
            updatePayload.departmentIds !== undefined
        ) {
            const existing = await this.timetableRepository.findById(
                input.id,
                input.eventId,
            );
            if (!existing) {
                return {
                    success: false,
                    error: 'タイムテーブルが見つかりません',
                    status: 404,
                };
            }

            const effectiveStart =
                updatePayload.startTime ?? existing.startTime;
            const effectiveEnd = updatePayload.endTime ?? existing.endTime;
            if (effectiveEnd < effectiveStart) {
                return {
                    success: false,
                    error: '終了時刻は開始時刻以降にしてください',
                    status: 400,
                };
            }

            const effectiveIsPublic =
                updatePayload.isPublic ?? existing.isPublic;
            const effectiveDepartmentIds =
                updatePayload.departmentIds ??
                existing.departments.map((department) => department.id);
            if (!effectiveIsPublic && effectiveDepartmentIds.length === 0) {
                return {
                    success: false,
                    error: '全体向けまたは部署タグを1つ以上指定してください',
                    status: 400,
                };
            }
        }

        try {
            const updated = await this.timetableRepository.update(
                input.id,
                input.eventId,
                updatePayload,
            );
            if (!updated) {
                return {
                    success: false,
                    error: 'タイムテーブルが見つかりません',
                    status: 404,
                };
            }
            return { success: true, data: updated };
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
                error: 'タイムテーブルの更新中にエラーが発生しました',
                status: 500,
            };
        }
    }
}
