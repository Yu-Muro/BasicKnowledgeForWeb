export interface IAuthenticationRepository {
    signIn(
        email: string,
        password: string,
        headers: Headers,
    ): Promise<Response>;
    signOut(headers: Headers): Promise<Response>;
    getSessionUserId(headers: Headers): Promise<string | null>;
}
