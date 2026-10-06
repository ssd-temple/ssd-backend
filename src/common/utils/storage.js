const crypto = require("crypto");
const env = require("../../config/env");

/**
 * One place that decides where an uploaded image lands.
 *
 *   S3_BUCKET set    -> Amazon S3 (UAT/production on AWS). Credentials come from the EC2
 *                       instance role — never from env keys.
 *   S3_BUCKET empty  -> Cloudinary (local dev and the old Render setup).
 *
 * Either way the function resolves to `{ secure_url }`, the same shape Cloudinary returns, so the
 * upload middleware and every controller that stores the URL stay unchanged. Images already saved
 * with a Cloudinary URL keep working: those are absolute https:// URLs stored as-is.
 */
const EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

let s3Client = null;

function getS3() {
  if (s3Client) return s3Client;
  const { S3Client } = require("@aws-sdk/client-s3");
  s3Client = new S3Client({ region: env.AWS_REGION });
  return s3Client;
}

function publicUrlFor(key) {
  // CloudFront (or any custom domain) if configured, else the bucket's own https endpoint.
  let base = env.S3_PUBLIC_BASE_URL
    ? env.S3_PUBLIC_BASE_URL.trim().replace(/\/+$/, "")
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
  // The saved value must be an absolute URL: the frontend treats anything without a scheme as a
  // path on the API host. Tolerate a base typed without "https://".
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return `${base}/${key}`;
}

async function uploadToS3(buffer, folder, mimetype) {
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const ext = EXT_BY_MIME[mimetype] || "bin";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await getS3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      // Keys are random and never overwritten, so browsers/CDN may cache them for a long time.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return { secure_url: publicUrlFor(key) };
}

function uploadToCloudinary(buffer, folder) {
  const cloudinary = require("./cloudinary");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) =>
      error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });
}

/** Uploads one image buffer and resolves to `{ secure_url }`. */
async function uploadImageBuffer(buffer, folder, mimetype) {
  if (env.S3_BUCKET) return uploadToS3(buffer, folder, mimetype);
  return uploadToCloudinary(buffer, folder);
}

module.exports = { uploadImageBuffer, publicUrlFor };
