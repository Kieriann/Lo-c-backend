const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const upload       = multer({ storage: multer.memoryStorage() });
const { cloudinary } = require('../utils/cloudinary');
const { PrismaClient } = require('@prisma/client');
const prisma       = new PrismaClient();
const authenticate = require('../middlewares/authMiddleware');

router.use(authenticate);

/* ───── GET /api/realisations ─────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const realisations = await prisma.realisation.findMany({
      where:   { userId: req.user.id },
      include: { technos: true, files: true },
      orderBy: { id: 'asc' },
    });
    res.json(realisations);
  } catch (err) {
    console.error('GET /realisations', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── POST /api/realisations ────────────────────────── */
router.post('/', upload.any(), async (req, res) => {
  try {
    const userId   = req.user.id;
    const realData = JSON.parse(req.body.data || '[]');

    // 1) Création / mise à jour
    for (const [idx, r] of realData.entries()) {
      let recordId = r.id;

      if (recordId) {
        // MAJ d’une réal existante (hors fichiers)
        await prisma.realisation.update({
          where: { id: recordId },
          data: {
            title:       r.title,
            description: r.description,
            technos: {
              deleteMany: {},
              create:     r.technos.map(t => ({ name: t.name, level: t.level })),
            },
          },
        });
      } else {
        // Création d’une nouvelle réal
        const created = await prisma.realisation.create({
          data: {
            title:       r.title,
            description: r.description,
            userId,
            technos: {
              create: r.technos.map(t => ({ name: t.name, level: t.level })),
            },
          },
        });
        recordId = created.id;
        r.id     = created.id;
      }

              // 🆕 suppression des fichiers qui ont été retirés côté front
        const keptFileIds = (r.files || [])
          .filter(f => f.id)
          .map(f => f.id);
        await prisma.realisationFile.deleteMany({
          where: {
            realisationId: recordId,
            id: { notIn: keptFileIds },
          }
        });

      // 2) Ajout des nouveaux PDFs pour cette réal
      const pdfs = (req.files || []).filter(f => f.fieldname === `realFiles_${idx}`);
      for (const pdf of pdfs) {
        const up = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: 'realisations' },
            (err, result) => err ? reject(err) : resolve(result)
          ).end(pdf.buffer);
        });

        await prisma.realisationFile.create({
          data: {
            realisationId: recordId,
            fileName:      up.secure_url,
            originalName:  pdf.originalname,
            version:       up.version,
            publicId:      up.public_id,
            format:        up.format,
          },
        });
      }
    }

    // 3) Suppression des réalisations supprimées en front
    const existing = await prisma.realisation.findMany({
      where : { userId },
      select: { id: true },
    });
    const existingIds = existing.map(r => r.id);
    const keptIds     = realData.filter(r => r.id).map(r => r.id);
    await prisma.realisation.deleteMany({
      where: { id: { in: existingIds.filter(id => !keptIds.includes(id)) } },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /realisations', err);
    return res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});


module.exports = router;
