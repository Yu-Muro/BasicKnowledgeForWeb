import { readFile } from 'node:fs/promises';

const environments = ['dev', 'prod'];

const backend = JSON.parse(
    await readFile('apps/backend/wrangler.jsonc', 'utf8'),
);
const frontend = JSON.parse(
    await readFile('apps/frontend/wrangler.jsonc', 'utf8'),
);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertTerraformOwnsRoutes(config, label) {
    assert(config.workers_dev === false, `${label}: workers_dev must be false`);
    assert(
        config.routes === undefined,
        `${label}: top-level routes must be absent`,
    );

    for (const environment of environments) {
        const environmentConfig = config.env?.[environment];
        assert(
            environmentConfig,
            `${label}: missing ${environment} environment`,
        );
        assert(
            environmentConfig.workers_dev === false,
            `${label}/${environment}: workers_dev must be false`,
        );
        assert(
            environmentConfig.routes === undefined,
            `${label}/${environment}: routes must be owned by Terraform`,
        );
    }
}

assertTerraformOwnsRoutes(backend, 'backend');
assertTerraformOwnsRoutes(frontend, 'frontend');

const expected = {
    dev: {
        backendService: 'basic-knowledge-for-web-backend-dev',
        cacheBucket: 'basic-knowledge-for-web-next-cache-dev',
        hyperdrive: 'f7f0ede9c7464673ab6f5bdcf0753218',
        imageBucket: 'dev-basicknowledgeforweb',
    },
    prod: {
        backendService: 'basic-knowledge-for-web-backend',
        cacheBucket: 'basic-knowledge-for-web-next-cache',
        hyperdrive: '5a36ae3ca5ed4a4697040c00685f213e',
        imageBucket: 'basicknowledgeforweb',
    },
};

for (const environment of environments) {
    const backendConfig = backend.env[environment];
    const frontendConfig = frontend.env[environment];
    const contract = expected[environment];
    const backendSecrets = backendConfig.secrets?.required ?? [];
    const frontendSecrets = frontendConfig.secrets?.required ?? [];

    assert(
        backendSecrets.includes('JWT_SECRET') &&
            !backendSecrets.includes('DATABASE_URL'),
        `backend/${environment}: Wrangler must manage JWT_SECRET but not DATABASE_URL`,
    );
    assert(
        frontendSecrets.includes('JWT_SECRET'),
        `frontend/${environment}: Wrangler must manage JWT_SECRET`,
    );

    assert(
        backendConfig.hyperdrive?.some(
            ({ binding, id }) =>
                binding === 'HYPERDRIVE' && id === contract.hyperdrive,
        ),
        `backend/${environment}: Hyperdrive binding changed`,
    );
    assert(
        backendConfig.r2_buckets?.some(
            ({ binding, bucket_name: bucketName }) =>
                binding === 'SHOP_ITEM_ASSET_BUCKET' &&
                bucketName === contract.imageBucket,
        ),
        `backend/${environment}: image R2 binding changed`,
    );
    assert(
        frontendConfig.services?.some(
            ({ binding, service }) =>
                binding === 'BACKEND' && service === contract.backendService,
        ),
        `frontend/${environment}: backend service binding changed`,
    );
    assert(
        frontendConfig.r2_buckets?.some(
            ({ binding, bucket_name: bucketName }) =>
                binding === 'NEXT_INC_CACHE_R2_BUCKET' &&
                bucketName === contract.cacheBucket,
        ),
        `frontend/${environment}: OpenNext R2 binding changed`,
    );
}

assert(
    frontend.assets?.binding === 'ASSETS' &&
        frontend.assets?.directory === '.open-next/assets',
    'frontend: OpenNext asset binding changed',
);

console.log('Wrangler ownership and binding contract is valid.');
