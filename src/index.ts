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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
