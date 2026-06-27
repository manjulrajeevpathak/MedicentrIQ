import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage for patient documents. core-api never handles file bytes when S3
 * is active — clients PUT/GET directly against presigned URLs. Two adapters:
 *
 *  - S3Adapter: real presigned PUT/GET URLs. Activated when S3_BUCKET (+ S3_REGION,
 *    optional S3_ENDPOINT for S3-compatible providers, AWS_ACCESS_KEY_ID /
 *    AWS_SECRET_ACCESS_KEY) are set.
 *  - LocalStorageAdapter (default fallback): returns core-api URLs
 *    `/storage/local/<key>` that the router serves from a local `.uploads/` dir.
 *    This makes the full upload→store→download flow testable with no cloud creds.
 *
 * The local URLs are keyed by an unguessable storage key (tenantId/patientId/uuid-…)
 * and are intentionally unauthenticated — acceptable for the local dev fallback only.
 */
export interface StorageService {
  readonly mode: "s3" | "local";
  getUploadUrl(key: string, contentType: string): Promise<string>;
  getDownloadUrl(key: string): Promise<string>;
}

class S3Adapter implements StorageService {
  readonly mode = "s3" as const;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    endpoint?: string
  ) {
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {})
      // Credentials are picked up from the standard AWS provider chain
      // (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / instance role / etc.).
    });
  }

  async getUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }

  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }
}

class LocalStorageAdapter implements StorageService {
  readonly mode = "local" as const;

  constructor(private readonly baseUrl: string) {}

  async getUploadUrl(key: string): Promise<string> {
    return `${this.baseUrl}/storage/local/${key}`;
  }

  async getDownloadUrl(key: string): Promise<string> {
    return `${this.baseUrl}/storage/local/${key}`;
  }
}

let singleton: StorageService | undefined;

export const createStorageService = (): StorageService => {
  if (singleton) return singleton;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (bucket && region) {
    singleton = new S3Adapter(bucket, region, process.env.S3_ENDPOINT);
    console.log(`[storage] S3 adapter active (bucket ${bucket}, region ${region}).`);
  } else {
    // Base URL the LocalStorageAdapter points back at — must be reachable by the
    // client that received the upload/download URL.
    const baseUrl = process.env.CORE_API_PUBLIC_URL ?? `http://127.0.0.1:${process.env.PORT ?? "4000"}`;
    singleton = new LocalStorageAdapter(baseUrl);
    console.log("[storage] Local disk adapter active (no S3_BUCKET set). Files land in .uploads/.");
  }
  return singleton;
};
