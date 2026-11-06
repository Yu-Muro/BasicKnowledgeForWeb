/** @jest-environment node */

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from '@jest/globals';

const contextSymbol = Symbol.for('__cloudflare-context__');
const contextGlobal = globalThis as typeof globalThis & Record<symbol, unknown>;
const originalEnv = process.env;
let backendFetch: typeof import('@frontend/app/lib/backendFetch');

beforeEach(() => {
    jest.resetModules();
    process.env = {
        ...originalEnv,
        NEXT_PUBLIC_API_URL: 'https://backend.example',
        BACKEND_FETCH_LOG: '1',
    };
    backendFetch = require('@frontend/app/lib/backendFetch');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    process.env = originalEnv;
    delete contextGlobal[contextSymbol];
    jest.restoreAllMocks();
});

describe('Backend通信先の制限', () => {
    it.each([
        '/api/rooms?event_id=event-1',
        'api/rooms?event_id=event-1',
        'https://backend.example/api/rooms?event_id=event-1',
    ])('設定済みBackendのパスとクエリを保持する: %s', (target) => {
        expect(backendFetch.buildBackendUrl(target)).toBe(
            'https://backend.example/api/rooms?event_id=event-1',
        );
    });

    it.each([
        'https://attacker.example/api/rooms',
        'http://169.254.169.254/latest/meta-data/',
        '//attacker.example/api/rooms',
        '/\\attacker.example/api/rooms',
        'https://backend.example.attacker.example/',
        'https://backend.example@attacker.example/',
        'https://user:password@backend.example/',
        'http://backend.example/api/rooms',
        'https://backend.example:8443/api/rooms',
        'file:///etc/passwd',
        'data:text/plain,test',
    ])('許可しないURLへ認証情報を送信しない: %s', async (target) => {
        const fetchMock = jest.spyOn(globalThis, 'fetch');
        const bindingFetch = jest.fn();
        contextGlobal[contextSymbol] = {
            env: { BACKEND: { fetch: bindingFetch } },
        };

        await expect(
            backendFetch.fetchFromBackend(target, {
                headers: { Cookie: 'auth_token=dummy' },
            }),
        ).rejects.toThrow();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(bindingFetch).not.toHaveBeenCalled();
    });

    it('HTTP経由ではリダイレクトを禁止し、認証ヘッダーとキャッシュ制御を維持する', async () => {
        const response = new Response('{}');
        const fetchMock = jest
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(response);

        expect(
            await backendFetch.fetchFromBackend('/api/rooms', {
                redirect: 'follow',
                headers: {
                    Cookie: 'auth_token=dummy',
                    'x-event-id': 'event-1',
                },
            }),
        ).toBe(response);

        expect(fetchMock).toHaveBeenCalledWith(
            'https://backend.example/api/rooms',
            expect.objectContaining({
                redirect: 'error',
                cache: 'no-store',
            }),
        );
        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get('Cookie')).toBe('auth_token=dummy');
        expect(headers.get('x-event-id')).toBe('event-1');
        expect(headers.get('Cache-Control')).toContain('no-store');
    });

    it('Service Bindingにも同じ通信先とリダイレクト制限を適用する', async () => {
        const response = new Response('{}');
        const bindingFetch = jest
            .fn<typeof fetch>()
            .mockResolvedValue(response);
        contextGlobal[contextSymbol] = {
            env: { BACKEND: { fetch: bindingFetch } },
        };
        const fetchMock = jest.spyOn(globalThis, 'fetch');

        expect(await backendFetch.fetchFromBackend('/api/rooms')).toBe(
            response,
        );

        const request = bindingFetch.mock.calls[0]?.[0] as Request;
        expect(request.url).toBe('https://backend.example/api/rooms');
        expect(request.redirect).toBe('error');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Service Bindingの失敗時にHTTP経由で更新を重複送信しない', async () => {
        const error = new Error('binding failed');
        const bindingFetch = jest.fn<typeof fetch>().mockRejectedValue(error);
        contextGlobal[contextSymbol] = {
            env: { BACKEND: { fetch: bindingFetch } },
        };
        const fetchMock = jest.spyOn(globalThis, 'fetch');

        await expect(
            backendFetch.fetchFromBackend('/api/rooms', { method: 'POST' }),
        ).rejects.toBe(error);

        expect(bindingFetch).toHaveBeenCalledTimes(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('Backend通信のログ', () => {
    it('URL内の書式指定子を解釈せず、機密ヘッダーを伏せる', async () => {
        jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

        await backendFetch.fetchFromBackend('/api/rooms?value=%s', {
            headers: { Cookie: 'auth_token=dummy' },
        });

        expect(console.log).toHaveBeenCalledWith(
            '[backendFetch]',
            expect.objectContaining({
                url: 'https://backend.example/api/rooms?value=%s',
                status: 200,
                request: expect.objectContaining({
                    headers: {
                        cookie: '[REDACTED]',
                        'cache-control': 'no-store, no-cache, must-revalidate',
                        pragma: 'no-cache',
                        expires: '0',
                    },
                }),
            }),
        );
    });

    it('失敗ログでもURLを固定メッセージと分ける', async () => {
        jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('failed'));

        await expect(
            backendFetch.fetchFromBackend('/api/rooms?value=%s'),
        ).rejects.toThrow('failed');

        expect(console.error).toHaveBeenCalledWith(
            '[backendFetch] ERROR',
            expect.objectContaining({
                url: 'https://backend.example/api/rooms?value=%s',
                error: 'failed',
            }),
        );
    });
});
