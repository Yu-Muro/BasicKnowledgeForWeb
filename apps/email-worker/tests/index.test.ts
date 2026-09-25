import { handleInternalSend } from '@email-worker/src/index';
import { describe, expect, jest, test } from '@jest/globals';

function createSendMock() {
    return jest
        .fn<SendEmail['send']>()
        .mockResolvedValue({ messageId: 'test-message-id' });
}

function createEnv(send = createSendMock()): Env {
    return {
        EMAIL_FROM: 'noreply@reitaisai.info',
        EMAIL: { send: send as SendEmail['send'] },
    };
}

describe('handleInternalSend', () => {
    test('returns 400 for invalid request body', async () => {
        const request = new Request('https://example.com/internal/email/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({ template: 'login_otp' }),
        });

        const response = await handleInternalSend(request, createEnv());

        expect(response.status).toBe(400);
    });

    test('returns 400 for invalid code format', async () => {
        const send = createSendMock();
        const request = new Request('https://example.com/internal/email/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                to: 'user@example.com',
                template: 'email_verification',
                code: '12345',
            }),
        });

        const response = await handleInternalSend(request, createEnv(send));

        expect(response.status).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid recipient email', async () => {
        const send = createSendMock();
        const request = new Request('https://example.com/internal/email/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                to: 'invalid-email',
                template: 'login_otp',
                code: '123456',
            }),
        });

        const response = await handleInternalSend(request, createEnv(send));

        expect(response.status).toBe(400);
        expect(send).not.toHaveBeenCalled();
    });

    test('sends email and returns 200 for valid request', async () => {
        const send = createSendMock();
        const request = new Request('https://example.com/internal/email/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                to: 'user@example.com',
                template: 'email_verification',
                code: '123456',
            }),
        });

        const response = await handleInternalSend(request, createEnv(send));

        expect(response.status).toBe(200);
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith({
            from: 'noreply@reitaisai.info',
            to: 'user@example.com',
            subject: 'Verify your email',
            text: 'Your verification code is 123456. This code expires in 10 minutes.',
        });
    });

    test('returns 502 and logs only non-sensitive context when sending fails', async () => {
        const send = createSendMock().mockRejectedValue(
            Object.assign(new Error('provider failure'), {
                code: 'email.sending.error.internal',
            }),
        );
        const consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const request = new Request('https://example.com/internal/email/send', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                to: 'user@example.com',
                template: 'login_otp',
                code: '654321',
            }),
        });

        try {
            const response = await handleInternalSend(request, createEnv(send));

            expect(response.status).toBe(502);
            await expect(response.json()).resolves.toEqual({
                error: 'email delivery failed',
            });
            expect(consoleError).toHaveBeenCalledWith('Email delivery failed', {
                errorCode: 'email.sending.error.internal',
                template: 'login_otp',
            });
            expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
                'user@example.com',
            );
            expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
                '654321',
            );
        } finally {
            consoleError.mockRestore();
        }
    });
});
