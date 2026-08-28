const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const crypto       = require('crypto');
const upload       = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20, fields: 10 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE'));
    return callback(null, true);
  },
});
const { assetUrl, cloudinary } = require('../utils/cloudinary');
const prisma = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roles');
const { cleanText, positiveInt } = require('../utils/security');

router.use(authenticate, requireRole('INDEP'));

/* ───── GET /api/realisations ─────────────────────────── */
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const realisations = await prisma.realisation.findMany({
      where:   { userId: req.user.id },
      include: { technos: true, files: true },
      orderBy: { id: 'asc' },
    });
    res.json(realisations.map(realisation => ({
      ...realisation,
      files: realisation.files.map(file => ({
        id: file.id,
        originalName: file.originalName,
        url: assetUrl({
          publicId: file.publicId,
          resourceType: 'raw',
          deliveryType: file.deliveryType,
          version: file.version,
          format: file.format,
        }),
      })),
    })));
  } catch (err) {
    console.error('GET /realisations', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* ───── POST /api/realisations ────────────────────────── */
router.post('/', upload.any(), async (req, res) => {
  try {
    const userId   = req.user.id;
    let realData;
    try { realData = JSON.parse(req.body.data || '[]'); } catch { realData = null; }
    if (!Array.isArray(realData) || realData.length > 20) {
      return res.status(400).json({ error: 'INVALID_REALISATIONS' });
    }

    const invalidFile = (req.files || []).find(file => {
      const match = /^realFiles_(\d+)$/.exec(file.fieldname);
      return !match || Number(match[1]) >= realData.length || file.buffer?.subarray(0, 5).toString('ascii') !== '%PDF-';
    });
    if (invalidFile) return res.status(400).json({ error: 'INVALID_PDF' });

    const suppliedIds = [...new Set(realData.map(r => positiveInt(r.id, { min: 1 })).filter(Boolean))];
    if (suppliedIds.length) {
      const owned = await prisma.realisation.count({
        where: { id: { in: suppliedIds }, userId },
      });
      if (owned !== suppliedIds.length) return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // 1) Création / mise à jour
    for (const [idx, r] of realData.entries()) {
      let recordId = positiveInt(r.id, { min: 1 });
      const title = cleanText(r.title, { max: 200 });
      const description = cleanText(r.description, { max: 5000 });

      if (recordId) {
        // MAJ d’une réal existante (hors fichiers)
        await prisma.realisation.update({
          where: { id: recordId },
          data: {
            title,
            description,
            technos: {
              deleteMany: {},
              create:     (Array.isArray(r.technos) ? r.technos : []).slice(0, 30).map(t => ({
                name: String(t.name || '').trim().slice(0, 80),
                level: String(t.level || '').trim().slice(0, 40),
              })).filter(t => t.name),
            },
          },
        });
      } else {
        // Création d’une nouvelle réal
        const created = await prisma.realisation.create({
          data: {
            title,
            description,
            userId,
            technos: {
              create: (Array.isArray(r.technos) ? r.technos : []).slice(0, 30).map(t => ({
                name: String(t.name || '').trim().slice(0, 80),
                level: String(t.level || '').trim().slice(0, 40),
              })).filter(t => t.name),
            },
          },
        });
        recordId = created.id;
        r.id     = created.id;
      }

              // 🆕 suppression des fichiers qui ont été retirés côté front
        const keptFileIds = (Array.isArray(r.files) ? r.files : [])
          .filter(f => f.id)
          .map(f => positiveInt(f.id, { min: 1 }))
          .filter(Boolean);
        const removedFiles = await prisma.realisationFile.findMany({
          where: { realisationId: recordId, id: { notIn: keptFileIds } },
          select: { publicId: true, deliveryType: true },
        });
        await prisma.realisationFile.deleteMany({
          where: {
            realisationId: recordId,
            id: { notIn: keptFileIds },
          }
        });
        await Promise.allSettled(removedFiles.map(file =>
          cloudinary.uploader.destroy(file.publicId, { resource_type: 'raw', type: file.deliveryType })
        ));

      // 2) Ajout des nouveaux PDFs pour cette réal
      const pdfs = (req.files || []).filter(f => f.fieldname === `realFiles_${idx}`);
      for (const pdf of pdfs) {
        const up = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw',
              type: 'authenticated',
              folder: `realisations/${userId}/${recordId}`,
              public_id: crypto.randomUUID(),
              overwrite: false,
            },
            (err, result) => err ? reject(err) : resolve(result)
          ).end(pdf.buffer);
        });

        await prisma.realisationFile.create({
          data: {
            realisationId: recordId,
            fileName:      up.secure_url,
            originalName:  cleanText(pdf.originalname, { max: 255 }),
            version:       up.version,
            publicId:      up.public_id,
            format:        up.format || 'pdf',
            deliveryType:  'authenticated',
          },
        });
      }
    }

    // 3) Suppression des réalisations supprimées en front
    const existing = await prisma.realisation.findMany({
      where : { userId },
      select: { id: true, files: { select: { publicId: true, deliveryType: true } } },
    });
    const existingIds = existing.map(r => r.id);
    const keptIds     = realData.filter(r => r.id).map(r => r.id);
    await prisma.realisation.deleteMany({
      where: { id: { in: existingIds.filter(id => !keptIds.includes(id)) } },
    });
    const keptSet = new Set(keptIds);
    const orphanedCloudFiles = existing
      .filter(row => !keptSet.has(row.id))
      .flatMap(row => row.files || []);
    await Promise.allSettled(orphanedCloudFiles.map(file =>
      cloudinary.uploader.destroy(file.publicId, { resource_type: 'raw', type: file.deliveryType })
    ));

    return res.json({ success: true });
  } catch (err) {
    console.error('POST /realisations', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;
