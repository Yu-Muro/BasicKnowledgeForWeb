import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import { ShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/ShopItemRepository';
import {
    createShopItem,
    deleteShopItem,
    getShopItems,
    updateShopItem,
    uploadShopItemImage,
} from '@backend/src/presentation/controllers/shopItemController';
import { contentAccessMiddleware } from '@backend/src/presentation/middleware/contentAccessMiddleware';
import { contentEditMiddleware } from '@backend/src/presentation/middleware/contentEditMiddleware';
import { roleGuard } from '@backend/src/presentation/middleware/roleGuard';
import { CreateShopItemUseCase } from '@backend/src/use-cases/shop-item/CreateShopItemUseCase';
import { DeleteShopItemUseCase } from '@backend/src/use-cases/shop-item/DeleteShopItemUseCase';
import { GetShopItemsUseCase } from '@backend/src/use-cases/shop-item/GetShopItemsUseCase';
import { UpdateShopItemUseCase } from '@backend/src/use-cases/shop-item/UpdateShopItemUseCase';
import { UploadShopItemImageUseCase } from '@backend/src/use-cases/shop-item/UploadShopItemImageUseCase';
import { Hono } from 'hono';
import type { ContentEditVariables } from '../middleware/contentEditMiddleware';

type ShopItemRepositoryFactory = (env: Env) => IShopItemRepository;

export function createShopItemRoutes(
    repositoryFactory: ShopItemRepositoryFactory = (env) =>
        new ShopItemRepository(createDatabaseClient(env)),
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    const EDITOR_ROLES = ['admin', 'user'];

    app.get('/shop-items', contentAccessMiddleware, async (c) => {
        const repository = repositoryFactory(c.env);
        const useCase = new GetShopItemsUseCase(repository);
        return getShopItems(c, useCase);
    });

    app.post(
        '/shop-items',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new CreateShopItemUseCase(
                repository,
                c.env.SHOP_ITEM_ASSET_BASE_URL,
            );
            return createShopItem(c, useCase);
        },
    );

    app.put(
        '/shop-items/:id',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new UpdateShopItemUseCase(
                repository,
                c.env.SHOP_ITEM_ASSET_BASE_URL,
            );
            return updateShopItem(c, useCase);
        },
    );

    app.delete(
        '/shop-items/:id',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new DeleteShopItemUseCase(repository);
            return deleteShopItem(c, useCase);
        },
    );

    app.post(
        '/shop-items/upload',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const useCase = new UploadShopItemImageUseCase(
                c.env.SHOP_ITEM_ASSET_BUCKET,
            );
            return uploadShopItemImage(c, useCase);
        },
    );

    return app;
}
