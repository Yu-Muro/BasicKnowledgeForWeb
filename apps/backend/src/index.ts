import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './db/connection';
import { createAccessCodeRoutes } from './presentation/routes/accessCodeRoutes';
import { createAuthenticationContext } from './presentation/routes/authenticationContext';
import { createAuthRoutes } from './presentation/routes/authRoutes';
import { createDepartmentRoutes } from './presentation/routes/departmentRoutes';
import { createHealthRoutes } from './presentation/routes/healthRoutes';
import { createOtherItemRoutes } from './presentation/routes/otherItemRoutes';
import { createProgramRoutes } from './presentation/routes/programRoutes';
import { createRoomRoutes } from './presentation/routes/roomRoutes';
import { createSearchRoutes } from './presentation/routes/searchRoutes';
import { createShopItemRoutes } from './presentation/routes/shopItemRoutes';
import { createTimetableRoutes } from './presentation/routes/timetableRoutes';
import { createUserRoutes } from './presentation/routes/userRoutes';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

app.use(
    '*',
    cors({
        origin: [
            'https://reitaisai.info',
            'https://dev.reitaisai.info',
            'http://localhost:8771',
        ],
        credentials: true,
    }),
);
app.get('/assets/*', async (c) => {
    const key = c.req.path.replace(/^\/assets\//, '');
    if (!key) {
        return c.notFound();
    }
    const object = await c.env.SHOP_ITEM_ASSET_BUCKET.get(key);
    if (!object) {
        return c.notFound();
    }
    return new Response(object.body, {
        headers: {
            'Content-Type':
                object.httpMetadata?.contentType ?? 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
});

app.use('/api/*', createAuthenticationContext());

const appWithRoutes = app
    .route('/api', createHealthRoutes())
    .route('/api', createUserRoutes())
    .route('/api', createAuthRoutes())
    .route('/api', createAccessCodeRoutes())
    .route('/api', createTimetableRoutes())
    .route('/api', createRoomRoutes())
    .route('/api', createProgramRoutes())
    .route('/api', createShopItemRoutes())
    .route('/api', createDepartmentRoutes())
    .route('/api', createOtherItemRoutes())
    .route('/api', createSearchRoutes());

export type AppType = typeof appWithRoutes;

export default app;
