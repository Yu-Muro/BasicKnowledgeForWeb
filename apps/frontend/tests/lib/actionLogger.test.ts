import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import { afterEach, expect, it, jest } from '@jest/globals';

afterEach(() => jest.restoreAllMocks());

it('操作ログで外部入力をフォーマット文字列として扱わない', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    logAction('update', 'POST', '/api/rooms/%s', 200);
    expect(log).toHaveBeenCalledWith('[action]', {
        action: 'update',
        method: 'POST',
        url: '/api/rooms/%s',
        status: 200,
    });
});

it('操作の失敗ログでも外部入力をデータとして扱う', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    logActionError('update', 'POST', '/api/rooms/%s', new Error('failed'));
    expect(log).toHaveBeenCalledWith('[action] ERROR', {
        action: 'update',
        method: 'POST',
        url: '/api/rooms/%s',
        error: 'failed',
    });
});
