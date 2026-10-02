import {
    type EmailTemplateType,
    isValidEmailCode,
    renderEmailTemplate,
} from '@email-worker/src/emailTemplates';

type SendEmailRequestBody = {
    code: string;
    template: EmailTemplateType;
    to: string;
};

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message: string) {
    return Response.json({ error: message }, { status: 400 });
}

function isValidEmailAddress(email: string): boolean {
    return email.length <= 254 && EMAIL_ADDRESS_PATTERN.test(email);
}

function getEmailErrorCode(error: unknown): string {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return 'unknown';
    }

    const code = error.code;
    return typeof code === 'string' || typeof code === 'number'
        ? String(code)
        : 'unknown';
}

async function parseBody(
    request: Request,
): Promise<SendEmailRequestBody | null> {
    const body = (await request
        .json()
        .catch(() => null)) as Partial<SendEmailRequestBody> | null;

    if (!body) {
        return null;
    }

    if (
        typeof body.to !== 'string' ||
        typeof body.code !== 'string' ||
        (body.template !== 'email_verification' &&
            body.template !== 'login_otp')
    ) {
        return null;
    }

    if (!isValidEmailAddress(body.to) || !isValidEmailCode(body.code)) {
        return null;
    }

    return {
        to: body.to,
        code: body.code,
        template: body.template,
    };
}

export async function handleInternalSend(request: Request, env: Env) {
    const payload = await parseBody(request);
    if (!payload) {
        return badRequest('invalid request body');
    }

    const rendered = renderEmailTemplate(payload);
    try {
        await env.EMAIL.send({
            from: env.EMAIL_FROM,
            to: payload.to,
            subject: rendered.subject,
            text: rendered.text,
        });
    } catch (error) {
        console.error('Email delivery failed', {
            errorCode: getEmailErrorCode(error),
            template: payload.template,
        });
        return Response.json(
            { error: 'email delivery failed' },
            { status: 502 },
        );
    }

    return Response.json({ ok: true }, { status: 200 });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (
            request.method === 'POST' &&
            url.pathname === '/internal/email/send'
        ) {
            return handleInternalSend(request, env);
        }

        return Response.json({ error: 'not found' }, { status: 404 });
    },
} satisfies ExportedHandler<Env>;
