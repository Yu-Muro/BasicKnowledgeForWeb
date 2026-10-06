export type LoginInput = {
    email: string;
    password: string;
    headers: Headers;
};

export type LoginSuccess = {
    success: true;
    data: { cookies: string[] };
};

export type LoginFailure = {
    success: false;
    error: string;
    status: number;
};

export type LoginResult = LoginSuccess | LoginFailure;

export interface ILoginUseCase {
    execute(input: LoginInput): Promise<LoginResult>;
}
