/**
 * Campaign Production Design Guide — PDF Generator
 *
 * Generates a cinematic production design guide PDF from a campaign's
 * Director's Package. Mirrors the Seedance-style production bible format:
 * - Title card (campaign name, artist, genre, logline)
 * - Character design (appearance, wardrobe, material notes)
 * - Color palette (swatches with Kelvin values and emotional notes)
 * - Set design (key environments with lighting notes)
 * - Shot storyboard (numbered shots with descriptions)
 * - Art department notes (tone, time period, palette, texture, theme)
 */

import PDFDocument from "pdfkit";
import { Readable } from "stream";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  kelvin: string;
  grade: string;
  emotionalNote?: string;
}

interface CharacterDesign {
  appearance: string;
  wardrobe: string;
  materialNotes: string;
  lightingInteraction: string;
}

interface SetDesignEntry {
  name: string;
  description: string;
  lightingSetup: string;
  atmosphericNote?: string;
}

interface ShotEntry {
  shotNumber: number;
  shotType: string;
  description: string;
  durationSeconds: number;
  cameraMovement: string;
  lightingNote: string;
  atmosphericNote?: string;
  editNote?: string;
  emotionalFunction?: string;
}

interface ArtDepartmentNotes {
  tone: string;
  timePeriod: string;
  palette: string;
  texture: string;
  theme: string;
}

interface DirectorsPackage {
  logline?: string;
  visualIdentityStatement?: string;
  colorPalette?: ColorPalette;
  characterDesign?: CharacterDesign;
  setDesign?: SetDesignEntry[];
  shotList?: ShotEntry[];
  productionNotes?: { cameraPackage: string; lightingSetup: string; atmosphericSetup: string; postGrade: string };
  artDepartmentNotes?: ArtDepartmentNotes;
  directorStatement?: string;
}

interface CampaignPdfInput {
  title: string;
  artistName?: string | null;
  genre: string;
  durationMode: string;
  campaignGoal: string;
  brief?: string | null;
  directorsPackage: DirectorsPackage;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const GENRE_ACCENT_COLORS: Record<string, [number, number, number]> = {
  psychedelic_vaporwave: [255, 0, 255],
  noir_jazz: [139, 69, 19],
  indie_folk: [212, 168, 83],
  hip_hop: [255, 215, 0],
  electronic: [0, 128, 255],
  punk_rock: [255, 0, 0],
  soul_rnb: [107, 26, 26],
  country: [212, 168, 83],
  experimental: [127, 0, 255],
};

const GENRE_NAMES: Record<string, string> = {
  psychedelic_vaporwave: "Psychedelic / Vaporwave",
  noir_jazz: "Noir Jazz",
  indie_folk: "Indie Folk",
  hip_hop: "Hip Hop",
  electronic: "Electronic / EDM",
  punk_rock: "Punk / Rock",
  soul_rnb: "Soul / R&B",
  country: "Country",
  experimental: "Experimental / Art",
};

const DURATION_LABELS: Record<string, string> = {
  "15s": "15 Seconds",
  "30s": "30 Seconds",
  "60s": "60 Seconds",
  full_song: "Full Song",
};

const GOAL_LABELS: Record<string, string> = {
  awareness: "Awareness",
  engagement: "Engagement",
  conversion: "Conversion",
  artist_brand: "Artist Brand",
};

// ── PDF Generation ────────────────────────────────────────────────────────────

export async function generateCampaignPdf(input: CampaignPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: input.title,
        Author: input.artistName ?? "Strawberry Studios",
        Subject: "Production Design Guide",
        Creator: "Strawberry Studios",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const accent = GENRE_ACCENT_COLORS[input.genre] ?? [200, 50, 50];
    const pkg = input.directorsPackage;
    const pageWidth = doc.page.width - 100; // margins

    // ── Helper functions ────────────────────────────────────────────────────

    const sectionHeader = (title: string) => {
      doc.moveDown(0.5);
      doc
        .rect(50, doc.y, pageWidth, 20)
        .fill([20, 20, 20]);
      doc
        .fillColor([accent[0], accent[1], accent[2]])
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(title.toUpperCase(), 58, doc.y - 16, { width: pageWidth - 16 });
      doc.fillColor("black").moveDown(0.8);
    };

    const labelValue = (label: string, value: string, x?: number, y?: number, width?: number) => {
      const startX = x ?? 50;
      const startY = y ?? doc.y;
      const w = width ?? pageWidth;
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor([100, 100, 100])
        .text(label.toUpperCase(), startX, startY, { width: w, continued: false });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("black")
        .text(value, startX, doc.y + 1, { width: w });
    };

    const divider = () => {
      doc.moveDown(0.3);
      doc
        .moveTo(50, doc.y)
        .lineTo(50 + pageWidth, doc.y)
        .strokeColor([220, 220, 220])
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.3);
    };

    // ── PAGE 1: Title Card ──────────────────────────────────────────────────

    // Background header block
    doc
      .rect(0, 0, doc.page.width, 160)
      .fill([10, 10, 10]);

    // Accent bar
    doc
      .rect(0, 0, 6, 160)
      .fill([accent[0], accent[1], accent[2]]);

    // "A PRODUCTION BY"
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor([150, 150, 150])
      .text("A PRODUCTION BY", 60, 30, { width: pageWidth });

    // Artist name
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor([accent[0], accent[1], accent[2]])
      .text((input.artistName ?? "Strawberry Studios").toUpperCase(), 60, 44, { width: pageWidth });

    // Campaign title
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("white")
      .text(input.title, 60, 65, { width: pageWidth });

    // Subtitle line
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor([180, 180, 180])
      .text("PRODUCTION DESIGN GUIDE", 60, 105, { width: pageWidth });

    // Genre + duration + goal tags
    const tags = [
      GENRE_NAMES[input.genre] ?? input.genre,
      DURATION_LABELS[input.durationMode] ?? input.durationMode,
      GOAL_LABELS[input.campaignGoal] ?? input.campaignGoal,
    ];
    let tagX = 60;
    tags.forEach((tag) => {
      const tagWidth = doc.widthOfString(tag) + 16;
      doc
        .rect(tagX, 122, tagWidth, 16)
        .fill([40, 40, 40]);
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor([accent[0], accent[1], accent[2]])
        .text(tag.toUpperCase(), tagX + 8, 127, { width: tagWidth - 16 });
      tagX += tagWidth + 6;
    });

    doc.y = 175;

    // Logline
    if (pkg.logline) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(12)
        .fillColor([50, 50, 50])
        .text(`"${pkg.logline}"`, 50, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.8);
    }

    // Visual Identity Statement
    if (pkg.visualIdentityStatement) {
      sectionHeader("Visual Identity");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("black")
        .text(pkg.visualIdentityStatement, 50, doc.y, { width: pageWidth });
      doc.moveDown(0.5);
    }

    // Brief
    if (input.brief) {
      sectionHeader("Campaign Brief");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("black")
        .text(input.brief, 50, doc.y, { width: pageWidth });
      doc.moveDown(0.5);
    }

    divider();

    // ── Character Design ────────────────────────────────────────────────────

    if (pkg.characterDesign) {
      sectionHeader("Character Design");
      const cd = pkg.characterDesign;
      const colW = (pageWidth - 10) / 2;

      const startY = doc.y;
      labelValue("Appearance", cd.appearance, 50, startY, colW);
      const midY = doc.y;
      labelValue("Wardrobe", cd.wardrobe, 50 + colW + 10, startY, colW);

      doc.y = Math.max(midY, doc.y) + 6;
      const startY2 = doc.y;
      labelValue("Material Notes", cd.materialNotes, 50, startY2, colW);
      labelValue("Lighting Interaction", cd.lightingInteraction, 50 + colW + 10, startY2, colW);
      doc.moveDown(0.5);
    }

    divider();

    // ── Color Palette ───────────────────────────────────────────────────────

    if (pkg.colorPalette) {
      sectionHeader("Color Palette");
      const cp = pkg.colorPalette;
      const swatchSize = 30;
      const swatchLabels = [
        { label: "Primary", value: cp.primary },
        { label: "Secondary", value: cp.secondary },
        { label: "Accent", value: cp.accent },
      ];

      const paletteStartY = doc.y;
      swatchLabels.forEach((s, i) => {
        const sx = 50 + i * 90;
        // Swatch box
        doc
          .rect(sx, paletteStartY, swatchSize, swatchSize)
          .fill([accent[0], accent[1], accent[2]]);
        doc
          .rect(sx, paletteStartY, swatchSize, swatchSize)
          .stroke([200, 200, 200]);
        // Label
        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor([100, 100, 100])
          .text(s.label.toUpperCase(), sx, paletteStartY + swatchSize + 3, { width: 80 });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("black")
          .text(s.value, sx, doc.y + 1, { width: 80 });
      });

      // Kelvin + Grade on the right
      const rightX = 50 + 3 * 90 + 20;
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor([100, 100, 100])
        .text("KELVIN", rightX, paletteStartY, { width: 200 });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("black")
        .text(cp.kelvin, rightX, doc.y + 1, { width: 200 });
      doc.moveDown(0.3);
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor([100, 100, 100])
        .text("COLOR GRADE", rightX, doc.y, { width: 200 });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("black")
        .text(cp.grade, rightX, doc.y + 1, { width: 200 });

      if (cp.emotionalNote) {
        doc.y = paletteStartY + swatchSize + 40;
        doc
          .font("Helvetica-Oblique")
          .fontSize(8)
          .fillColor([100, 100, 100])
          .text(cp.emotionalNote, 50, doc.y, { width: pageWidth });
      }

      doc.moveDown(0.8);
    }

    divider();

    // ── Set Design ──────────────────────────────────────────────────────────

    if (pkg.setDesign && pkg.setDesign.length > 0) {
      sectionHeader("Set Design");
      const sets = pkg.setDesign;
      const colW = (pageWidth - (sets.length - 1) * 10) / Math.min(sets.length, 3);

      const setStartY = doc.y;
      sets.slice(0, 3).forEach((set, i) => {
        const sx = 50 + i * (colW + 10);
        // Set box
        doc
          .rect(sx, setStartY, colW, 14)
          .fill([30, 30, 30]);
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("white")
          .text(set.name.toUpperCase(), sx + 4, setStartY + 3, { width: colW - 8 });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("black")
          .text(set.description, sx, setStartY + 20, { width: colW });
        doc
          .font("Helvetica-Oblique")
          .fontSize(7)
          .fillColor([120, 120, 120])
          .text(set.lightingSetup, sx, doc.y + 2, { width: colW });
      });
      doc.moveDown(1.5);
    }

    divider();

    // ── Art Department Notes ────────────────────────────────────────────────

    if (pkg.artDepartmentNotes) {
      sectionHeader("Notes for Art Department");
      const adn = pkg.artDepartmentNotes;
      const entries = Object.entries(adn) as [string, string][];
      const colW = (pageWidth - 20) / 5;

      const adnStartY = doc.y;
      entries.forEach(([key, value], i) => {
        const sx = 50 + i * (colW + 5);
        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor([100, 100, 100])
          .text(key.charAt(0).toUpperCase() + key.slice(1) + ":", sx, adnStartY, { width: colW });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("black")
          .text(value, sx, doc.y + 1, { width: colW });
      });
      doc.moveDown(1.5);
    }

    // ── PAGE 2+: Shot List ──────────────────────────────────────────────────

    if (pkg.shotList && pkg.shotList.length > 0) {
      doc.addPage();

      // Page header
      doc
        .rect(0, 0, doc.page.width, 50)
        .fill([10, 10, 10]);
      doc
        .rect(0, 0, 6, 50)
        .fill([accent[0], accent[1], accent[2]]);
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("white")
        .text("SHOT LIST", 60, 17, { width: pageWidth });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor([150, 150, 150])
        .text(`${pkg.shotList.length} shots · ${DURATION_LABELS[input.durationMode] ?? input.durationMode}`, 60, 35, { width: pageWidth });

      doc.y = 70;

      pkg.shotList.forEach((shot, idx) => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 120) {
          doc.addPage();
          doc.y = 40;
        }

        const shotStartY = doc.y;
        const shotBoxH = 80;

        // Shot number badge
        doc
          .circle(65, shotStartY + 12, 12)
          .fill([accent[0], accent[1], accent[2]]);
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("white")
          .text(String(shot.shotNumber), 58, shotStartY + 7, { width: 14, align: "center" });

        // Shot type + duration
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor("black")
          .text(shot.shotType, 85, shotStartY, { width: pageWidth - 40 });
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor([120, 120, 120])
          .text(`${shot.durationSeconds}s · ${shot.cameraMovement}`, 85, doc.y + 1, { width: pageWidth - 40 });

        // Description
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("black")
          .text(shot.description, 85, doc.y + 4, { width: pageWidth - 40 });

        // Lighting note
        if (shot.lightingNote) {
          doc
            .font("Helvetica-Oblique")
            .fontSize(8)
            .fillColor([100, 100, 100])
            .text(`Lighting: ${shot.lightingNote}`, 85, doc.y + 3, { width: pageWidth - 40 });
        }

        // Emotional function
        if (shot.emotionalFunction) {
          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor([accent[0], accent[1], accent[2]])
            .text(shot.emotionalFunction.toUpperCase(), 85, doc.y + 3, { width: pageWidth - 40 });
        }

        // Edit note
        if (shot.editNote) {
          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor([150, 150, 150])
            .text(`Edit: ${shot.editNote}`, 85, doc.y + 2, { width: pageWidth - 40 });
        }

        doc.moveDown(0.4);

        // Divider between shots
        if (idx < pkg.shotList!.length - 1) {
          doc
            .moveTo(85, doc.y)
            .lineTo(50 + pageWidth, doc.y)
            .strokeColor([230, 230, 230])
            .lineWidth(0.5)
            .stroke();
          doc.moveDown(0.4);
        }
      });
    }

    // ── Director's Statement ────────────────────────────────────────────────

    if (pkg.directorStatement) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        doc.y = 40;
      }
      doc.moveDown(0.5);
      sectionHeader("Director's Statement");
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor([50, 50, 50])
        .text(pkg.directorStatement, 50, doc.y, { width: pageWidth });
      doc.moveDown(0.5);
    }

    // ── Footer ──────────────────────────────────────────────────────────────

    const footerY = doc.page.height - 30;
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor([180, 180, 180])
      .text(
        `Strawberry Studios · ${input.title} · ${new Date().toLocaleDateString()}`,
        50,
        footerY,
        { width: pageWidth, align: "center" }
      );

    doc.end();
  });
}
