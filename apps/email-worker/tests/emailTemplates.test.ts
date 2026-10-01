import { renderEmailTemplate } from '@email-worker/src/emailTemplates';
import { describe, expect, test } from '@jest/globals';

describe('renderEmailTemplate', () => {
    test('renders verification template', () => {
        const rendered = renderEmailTemplate({
            template: 'email_verification',
            code: '123456',
        });

        expect(rendered.subject).toBe('Verify your email');
        expect(rendered.text).toContain('123456');
    });

    test('renders otp template', () => {
        const rendered = renderEmailTemplate({
            template: 'login_otp',
            code: '654321',
        });

        expect(rendered.subject).toBe('Your login OTP');
        expect(rendered.text).toContain('654321');
    });

    test('throws when code format is invalid', () => {
        expect(() =>
            renderEmailTemplate({
                template: 'login_otp',
                code: '12345',
            }),
        ).toThrow('code must be 6 digits');
    });
});
