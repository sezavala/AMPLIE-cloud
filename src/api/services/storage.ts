import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import { ENV } from "../../app/env.js";

const s3 = new S3Client({
  region: ENV.AWS_REGION,
  credentials: {
    accessKeyId: ENV.AWS_ACCESS_KEY_ID,
    secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
  },
});

// Upload file and generate 1-hour signed URL
export async function uploadToS3(localPath: string, key: string) {
  const file = fs.readFileSync(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: ENV.S3_BUCKET,
      Key: key,
      Body: file,
      ContentType: "audio/mpeg",
    })
  );

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }),
    { expiresIn: 3600 }
  );

  return url;
}
