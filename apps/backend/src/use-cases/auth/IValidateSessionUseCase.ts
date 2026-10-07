export type SessionUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId?: string | null;
};
export type SessionResult =
    | { success: true; data: SessionUser }
    | { success: false; error: string; status: 401 | 403 | 503 };
export interface IValidateSessionUseCase {
    execute(claims: SessionUser): Promise<SessionResult>;
}
