import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    checkPublicAuthRateLimit,
    PUBLIC_AUTH_RETRY_AFTER,
    toRateLimitSubject,
} from '@backend/src/presentation/middleware/publicAuthRateLimit';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import ts from 'typescript';

afterEach(() => {
    jest.restoreAllMocks();
});

describe('送信元の正規化', () => {
    it.each([
        ['192.0.2.1', '192.0.2.1'],
        ['2001:DB8:1234:5678::1', '2001:0db8:1234:5678::/64'],
        ['2001:0db8:1234:5678:abcd:ef01:2345:6789', '2001:0db8:1234:5678::/64'],
        ['2001:db8:1234:5679::1', '2001:0db8:1234:5679::/64'],
        ['::1', '0000:0000:0000:0000::/64'],
        ['::ffff:192.0.2.1', '0000:0000:0000:0000::/64'],
        ['::ffff:c000:201', '0000:0000:0000:0000::/64'],
        ['2001:db8:1234:5678::192.0.2.1', '2001:0db8:1234:5678::/64'],
    ])('%s', (ip, expected) => expect(toRateLimitSubject(ip)).toBe(expected));
    it.each(['bad', '2001::db8::1', '1:2:3', '999.1.1.1', 'fe80::1%eth0'])(
        '不正なIP %s は拒否',
        (ip) => expect(toRateLimitSubject(ip)).toBeNull(),
    );
});

describe('障害ログ', () => {
    it.each([
        ['missing-binding', undefined, '192.0.2.1'],
        ['missing-ip', { limit: async () => ({ success: true }) }, undefined],
        ['invalid-ip', { limit: async () => ({ success: true }) }, 'bad'],
        [
            'limiter-error',
            {
                limit: async () => {
                    throw new Error('private details');
                },
            },
            '192.0.2.1',
        ],
    ])('%s の理由だけを記録', async (reason, limiter, ip) => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => {});
        const result = await checkPublicAuthRateLimit({
            enabled: true,
            operation: 'login',
            limiter,
            ip,
        });
        expect(result?.status).toBe(503);
        expect(log).toHaveBeenCalledWith('public_auth_rate_limit_unavailable', {
            operation: 'login',
            reason,
        });
        expect(JSON.stringify(log.mock.calls)).not.toContain('private details');
        expect(JSON.stringify(log.mock.calls)).not.toContain('192.0.2.1');
    });
});

it.each(['元の設定', 'コメント・末尾カンマ付き'])(
    '%s: Devの期間とRetry-Afterが一致し、本番とnamespaceを共有しない',
    (format) => {
        const source = readFileSync(
            resolve(__dirname, '../../../wrangler.jsonc'),
            'utf8',
        );
        const text =
            format === '元の設定'
                ? source
                : source
                      .replace(
                          '"namespace_id": "1003",',
                          '"namespace_id": "1003", /* Dev */ // Dev専用',
                      )
                      .replace(
                          '"simple": { "limit": 60, "period": 60 }',
                          '"simple": { "limit": 60, "period": 60, },',
                      );
        const { config, error } = ts.parseConfigFileTextToJson(
            'wrangler.jsonc',
            text,
        );
        expect(error).toBeUndefined();
        const limiter = config.env.dev.ratelimits.find(
            (item: { name: string }) =>
                item.name === 'PUBLIC_AUTH_RATE_LIMITER',
        );
        expect(String(limiter.simple.period)).toBe(PUBLIC_AUTH_RETRY_AFTER);
        expect(
            config.env.prod.ratelimits?.some(
                (item: { namespace_id: string }) =>
                    item.namespace_id === limiter.namespace_id,
            ) ?? false,
        ).toBe(false);
    },
);
