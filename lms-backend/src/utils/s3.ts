import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '@/config/env';
import { badRequest } from '@/utils/apiError';

let s3: S3Client | null = null;

/**
 * Checks that S3 storage env vars are configured and returns them.
 * Throws a 400 Bad Request if storage is not configured so that the backend
 * can start without AWS credentials in the free Vercel deployment.
 */
function getStorageConfig() {
  if (!env.AWS_REGION || !env.S3_BUCKET_NAME || !env.CLOUDFRONT_DOMAIN) {
    throw badRequest('Storage is not configured in this deployment');
  }

  return {
    region: env.AWS_REGION,
    bucket: env.S3_BUCKET_NAME,
    cloudFrontDomain: env.CLOUDFRONT_DOMAIN
  };
}

function getS3Client() {
  const cfg = getStorageConfig();
  if (!s3) {
    s3 = new S3Client({ region: cfg.region });
  }
  return s3;
}

function joinUrl(base: string, key: string) {
  const b = base.replace(/\/$/, '');
  const k = key.replace(/^\//, '');
  return `${b}/${k}`;
}

export async function presignPutObject(params: {
  key: string;
  contentType: string;
  expiresInSeconds: number;
}) {
  const cfg = getStorageConfig();
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: params.key,
    ContentType: params.contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: params.expiresInSeconds });
  const publicUrl = joinUrl(cfg.cloudFrontDomain, params.key);

  return {
    uploadUrl,
    key: params.key,
    publicUrl,
    expiresIn: params.expiresInSeconds
  };
}
