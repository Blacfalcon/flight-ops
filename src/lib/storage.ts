import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

// S3-compatible file storage: MinIO on a unit server, AWS S3 in the cloud.
// Files are always streamed through the app after a permission check; storage is never exposed directly.

let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function s3(): S3Client {
  if (!client) {
    const c = env.s3();
    client = new S3Client({
      endpoint: c.endpoint,
      region: c.region,
      forcePathStyle: c.forcePathStyle,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return client;
}

/** Creates the bucket the first time it is needed, so no separate setup container is required. */
function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    const Bucket = env.s3().bucket;
    bucketReady = s3()
      .send(new HeadBucketCommand({ Bucket }))
      .then(() => undefined)
      .catch(async () => {
        await s3().send(new CreateBucketCommand({ Bucket }));
      })
      .catch((err) => {
        bucketReady = null; // try again next time
        throw err;
      });
  }
  return bucketReady;
}

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
  await ensureBucket();
  await s3().send(new PutObjectCommand({ Bucket: env.s3().bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string): Promise<{ body: Uint8Array; contentType: string }> {
  const res = await s3().send(new GetObjectCommand({ Bucket: env.s3().bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { body: bytes, contentType: res.ContentType ?? 'application/octet-stream' };
}
