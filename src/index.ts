import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import router from "./route/index";
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(router);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "Server is running" });
});

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.on("error", (err: any) => {
  console.error("Error occurred while starting the server:", err);
});

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err);
  process.exit(1); // Exit the process to avoid undefined behavior
});

const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down...`);

  server.close(() => {
    console.log("server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
