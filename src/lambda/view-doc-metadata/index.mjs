import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const handler = async () => {
  try {
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
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error("Error fetching RDS records:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to fetch RDS records",
      }),
    };
  }
};
