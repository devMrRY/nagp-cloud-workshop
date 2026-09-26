import { getPool } from "./db/pool.mjs";

export const handler = async () => {
  let pool;

  try {
    pool = await getPool();

    const result = await pool.query(`
      SELECT
        id,
        file_name,
        content_type,
        upload_timestamp
      FROM file_metadata
      ORDER BY upload_timestamp DESC
    `);

    console.log("RDS records:", result.rows);

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };

  } catch (error) {
    console.error("Error fetching RDS records:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch RDS records"
      })
    };

  }
};