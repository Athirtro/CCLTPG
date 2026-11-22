import { Global, Module } from '@nestjs/common';

import { env } from '../config/env.js';
import { LocalObjectStorage } from './local-object-storage.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.port.js';
import { S3ObjectStorage } from './s3-object-storage.js';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: (): ObjectStorage => {
        if (env.OBJECT_STORAGE_DRIVER === 's3') {
          return new S3ObjectStorage({
            endpoint: env.OBJECT_STORAGE_ENDPOINT!,
            bucket: env.OBJECT_STORAGE_BUCKET,
            region: env.OBJECT_STORAGE_REGION,
            accessKey: env.OBJECT_STORAGE_ACCESS_KEY!,
            secretKey: env.OBJECT_STORAGE_SECRET_KEY!,
            forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
          });
        }

        return new LocalObjectStorage(env.OBJECT_STORAGE_LOCAL_ROOT);
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
