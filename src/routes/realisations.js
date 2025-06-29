const express = require('express');
const router  = express.Router();

const multer   = require('multer');
const upload   = multer({ storage: multer.memoryStorage() });   
const { cloudinary } = require('../utils/cloudinary');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticate = require('../middlewares/authMiddleware');
router.use(authenticate);

/* ───── GET identique (ok) ───────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;  
    const realisations = await prisma.realisation.findMany({
      where  : { userId },
      include: { technos: true, files: true },
      orderBy: { id: 'asc' },
    });
    res.json(realisations);
  } catch (err) {
    console.error('GET /realisations', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── POST /api/realisations ───────────────────────── */
router.post('/', upload.any(), async (req, res) => {
  try {
    const userId   = req.user.id;
    const realData = JSON.parse(req.body.data || '[]');

    // 1. reset – plus simple pour l’instant
    await prisma.realisation.deleteMany({ where: { userId } });

    // 2. on recrée tout ; idx === position dans realData
    for (const [idx, r] of realData.entries()) {
      /* 2-a  ► réalisation + technos */
      const created = await prisma.realisation.create({
        data: {
          title      : r.title,
          description: r.description,
          userId,
          technos: {                                    // ← r.technos !
            create: r.technos.map(t => ({
              name : t.name,
              level: t.level
            }))
          }
        }
      });

      /* 2-b  ► fichiers PDF correspondant à cette réal */
const allFiles = Array.isArray(req.files) ? req.files : [];
const pdfs     = allFiles.filter(f => f.fieldname === `realFiles_${idx}`);
      for (const pdf of pdfs) {
        /* 2-b-1  upload Cloudinary (ou FS) */
        const up = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: 'realisations' },
            (err, result) => (err ? reject(err) : resolve(result))
          ).end(pdf.buffer);                 // memoryStorage ⇒ buffer
        });

        /* 2-b-2  ligne RealisationFile */
        await prisma.realisationFile.create({
          data: {
            realisationId: created.id,
            fileName     : up.secure_url,   // ou up.public_id, comme tu veux
            originalName : pdf.originalname,
            version      : up.version,
            publicId     : up.public_id,
            format       : up.format
          }
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /realisations', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
