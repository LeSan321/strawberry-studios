import express, { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { createContext } from "./_core/context";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/aac", "audio/ogg", "audio/webm"];
    if (allowed.includes(file.mimetype) || /\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Supported: MP3, M4A, WAV, AAC, OGG, WEBM"));
    }
  },
});

export function registerAudioUploadRoute(app: express.Application) {
  const router = Router();

  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      const multerReq = req as express.Request & { file?: Express.Multer.File };
      if (!multerReq.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Auth check
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const suffix = Math.random().toString(36).substring(2, 10);
      const ext = multerReq.file.originalname.split(".").pop() ?? "audio";
      const fileKey = `audio/${ctx.user.id}/${suffix}.${ext}`;

      const { url, key } = await storagePut(fileKey, multerReq.file.buffer, multerReq.file.mimetype);

      return res.json({ url, key, filename: multerReq.file.originalname, size: multerReq.file.size });
    } catch (err: any) {
      console.error("[AudioUpload] Error:", err);
      return res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });

  app.use("/api/audio", router);
}
