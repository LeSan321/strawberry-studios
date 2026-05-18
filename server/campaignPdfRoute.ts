import express, { Router } from "express";
import { createContext } from "./_core/context";
import { getCampaignById } from "./db";
import { generateCampaignPdf } from "./campaignPdfGenerator";

export function registerCampaignPdfRoute(app: express.Application) {
  const router = Router();

  router.get("/:id/pdf", async (req, res) => {
    try {
      // Auth check
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const campaignId = parseInt(req.params.id);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "Invalid campaign ID" });
      }

      const campaign = await getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Ownership check
      if (campaign.userId !== ctx.user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Parse directors package — drizzle json() returns already-parsed object
      const directorsPackage: Record<string, unknown> =
        campaign.directorsPackage && typeof campaign.directorsPackage === "object"
          ? (campaign.directorsPackage as Record<string, unknown>)
          : typeof campaign.directorsPackage === "string"
          ? (() => { try { return JSON.parse(campaign.directorsPackage as string); } catch { return {}; } })()
          : {};

      const pdfBuffer = await generateCampaignPdf({
        title: campaign.title,
        artistName: campaign.artistName,
        genre: campaign.genre,
        durationMode: campaign.durationMode,
        campaignGoal: campaign.campaignGoal,
        brief: campaign.brief,
        directorsPackage,
      });

      const filename = `${campaign.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_production_guide.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[CampaignPdf] Error:", err);
      return res.status(500).json({ error: err.message ?? "PDF generation failed" });
    }
  });

  app.use("/api/campaigns", router);
}
