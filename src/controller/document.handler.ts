import path from 'path';
import { Request, Response } from 'express';
import { completeMultipartUpload, createMultipartUpload, createPresignedPartUrl } from '../services/s3.service';
import { Worker } from 'node:worker_threads';

const PART_SIZE = 5 * 1024 * 1024; // 5 MB

export const serveHomePage = (req: Request, res: Response) => {
  const fileName = 'index.html';
  const safeName = path.basename(fileName);
  const filePath = path.join(process.cwd(), 'dist', 'public', safeName);

  res.sendFile(filePath);
};

export const initiateUpload = async (req: Request, res: Response) => {
  const { fileName, contentType, fileSize } = req.body;

  if (!fileName || !contentType || !fileSize) {
    return res.status(400).json({
      error: "fileName, contentType, and fileSize are required",
    });
  }

  const key = `uploads/${Date.now()}-${fileName}`;
  const uploadId = await createMultipartUpload(key, contentType);

  const presignedUrls: string[] = [];
  const totalParts = Math.ceil(fileSize / PART_SIZE);

  for (let i = 1; i <= totalParts; i++) {
    const url = await createPresignedPartUrl(key, uploadId, i);
    presignedUrls.push(url);
  }

  return res.status(200).json({
    message: "Presigned URLs generated successfully",
    key,
    uploadId,
    presignedUrls,
  });
};

export const completeUpload = async (req: Request, res: Response) => {
  const { key, uploadId, parts } = req.body;
  const result = await completeMultipartUpload(key, uploadId, parts);

  return res.status(200).json({
    message: "Multipart upload completed successfully",
    key,
    uploadId,
    parts,
    result,
  });
};

export const loadTest = (req: Request, res: Response) => {
  const workerPath = path.resolve(__dirname, "../workers/load-worker.js");

  const worker = new Worker(workerPath);

  worker.on("message", (result) => {
    res.json(result);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Worker failed",
      });
    }
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
}