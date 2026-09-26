import {
  S3Client,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getPool } from "./db/pool.mjs";

const s3 = new S3Client({});

export const handler = async (event) => {
  console.log("S3 event:", JSON.stringify(event, null, 2));

  let client;

  try {
    client = await getPool();

    for (const record of event.Records || []) {
      const bucketName = record.s3.bucket.name;

      const objectKey = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " ")
      );

      // Get metadata from S3
      const headResponse = await s3.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey
        })
      );

      const contentType = headResponse.ContentType || "unknown";

      console.log("File:", objectKey);
      console.log("Content-Type:", contentType);

      // Insert metadata into PostgreSQL
      await client.query(
        `
        INSERT INTO file_metadata
          (file_name, content_type, upload_timestamp)
        VALUES
          ($1, $2, CURRENT_TIMESTAMP)
        `,
        [objectKey, contentType]
      );

      console.log("Metadata inserted successfully");
    }

    return {
      statusCode: 200,
      body: "Metadata processed successfully"
    };

  } catch (err) {
    console.error("Error:", err);
    throw err;
  }
};
