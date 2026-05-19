import express, { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { createContext } from "./_core/context";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — reference images don't need to be large
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype) || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Supported: JPG, PNG, WEBP, GIF"));
    }
  },
});

export function registerMoodBoardUploadRoute(app: express.Application) {
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
      const ext = multerReq.file.originalname.split(".").pop() ?? "jpg";
      const fileKey = `mood-board/${ctx.user.id}/${suffix}.${ext}`;

      const { url, key } = await storagePut(fileKey, multerReq.file.buffer, multerReq.file.mimetype);

      return res.json({ url, key, filename: multerReq.file.originalname, size: multerReq.file.size });
    } catch (err: any) {
      console.error("[MoodBoardUpload] Error:", err);
      return res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });

  app.use("/api/mood-board", router);
}
