const express = require('express')
const router = express.Router()
const multer = require('multer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const authenticateToken = require('../middlewares/authMiddleware')
const { v2: cloudinary } = require('cloudinary')
const streamifier = require('streamifier')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

router.use(authenticateToken)

const upload = multer({ storage: multer.memoryStorage() })

router.post(
  '/',
  upload.any(),
  async (req, res) => {
    try {
      /* ------------------------------------------------------------------ */
      /* 0. Lecture payload et regroupement des fichiers uploadés           */
      /* ------------------------------------------------------------------ */
      const userId = req.user.id;
      const data = JSON.parse(req.body.data);
      const realFilesGrouped = {};              // { idx → [file, …] }

      console.log('>>> payload reçue\n', JSON.stringify(data, null, 2));

      // On regroupe les fichiers selon leur index (real-<idx>-nom.pdf)
      for (const file of req.files || []) {
        const match = file.originalname.match(/^real-(\d+)-/);
        if (match) {
          const idx = Number(match[1]);
          if (!realFilesGrouped[idx]) realFilesGrouped[idx] = [];
          realFilesGrouped[idx].push(file);
          console.log('>>> fichier uploadé trouvé', {
            idx,
            originalName: file.originalname,
            mime: file.mimetype,
            size: file.size,
          });
        }
      }

      /* ------------------------------------------------------------------ */
      /* 1. Détermination des IDs à conserver                               */
      /* ------------------------------------------------------------------ */
      const idsToKeep = [];       // fichiers
      const realIdsToKeep = [];   // réalisations

      for (const r of data) {
        if (r.id) realIdsToKeep.push(r.id);
        for (const f of r.files || []) {
          if (f.id) idsToKeep.push(f.id);
        }
      }

      console.log('>>> realIdsToKeep =', realIdsToKeep);
      console.log('>>> fileIdsToKeep  =', idsToKeep);

      /* ------------------------------------------------------------------ */
      /* 2. Nettoyage (technos, fichiers, réalisations supprimées)          */
      /* ------------------------------------------------------------------ */

      await prisma.techno.deleteMany({
        where: { realisation: { userId, id: { notIn: realIdsToKeep } } },
      });
      console.log('Suppression des technos orphelines OK');

      const { count: del1 } = await prisma.realisationFile.deleteMany({
        where: {
          realisationId: { in: realIdsToKeep },
          NOT: { id: { in: idsToKeep } },
        },
      });
      console.log('>>> deleteMany (fichiers non conservés) →', del1, 'supprimés');

      const { count: del2 } = await prisma.realisationFile.deleteMany({
        where: {
          realisationId: { notIn: realIdsToKeep },
          realisation: { userId },
        },
      });
      console.log('Suppression des fichiers des réalisations supprimées OK →', del2);

      const { count: del3 } = await prisma.realisation.deleteMany({
        where: { userId, id: { notIn: realIdsToKeep } },
      });
      console.log('Suppression des réalisations supprimées OK →', del3);

      /* ------------------------------------------------------------------ */
      /* 3. Boucle CREATE / UPDATE                                          */
      /* ------------------------------------------------------------------ */
      for (let i = 0; i < data.length; i++) {
        const r = data[i];
        const relatedDocs = realFilesGrouped[i] || [];

        if (r.id) {
          /* ---------- UPDATE ---------- */
          await prisma.realisation.update({
            where: { id: r.id },
            data: {
              title: r.title,
              description: r.description,
              techs: {
                deleteMany: {},
                create: (r.techs || []).map(t => ({
                  name: t.name,
                  level: t.level,
                })),
              },
            },
          });
          console.log('Update réalisation OK', r.id);
          if (relatedDocs.length) {
            console.warn(
              `⚠️  ${relatedDocs.length} nouveau(x) fichier(s) ignoré(s) pour ` +
              `la réalisation ${r.id} – utilisez /upload-document`
            );
          }
        } else {
          /* ---------- CREATE ---------- */
          await prisma.$transaction(async tx => {
            const createdReal = await tx.realisation.create({
              data: {
                title: r.title,
                description: r.description,
                userId,
                techs: {
                  create: (r.techs || []).map(t => ({
                    name: t.name,
                    level: t.level,
                  })),
                },
              },
            });
            console.log('Création réalisation OK', createdReal.id);

            for (const doc of relatedDocs) {
              if (!doc?.buffer) continue;

              /* Upload Cloudinary */
              const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                  { folder: 'realisations' },
                  (err, resUpload) => (err ? reject(err) : resolve(resUpload))
                );
                streamifier.createReadStream(doc.buffer).pipe(stream);
              });

              /* Insertion en base */
              const createdFile = await tx.realisationFile.create({
                data: {
                  realisationId: createdReal.id,
                  fileName: result.original_filename || doc.originalname,
                  version: result.version ? parseInt(result.version, 10) : null,
                  publicId: (result.public_id || '').replace(/^realisations\//, ''),
                  format: result.format || 'pdf',
                  originalName: (doc.originalname || 'SansNom').replace(/\s+/g, '_'),
                },
              });

              console.log('>>> fichier créé', {
                id: createdFile.id,
                realisationId: createdReal.id,
                originalName: createdFile.originalName,
                publicId: createdFile.publicId,
                version: createdFile.version,
              });
            }
          });
        }
      }

      /* ------------------------------------------------------------------ */
      /* 4. Fin                                                             */
      /* ------------------------------------------------------------------ */
      res.status(200).json({ success: true });
    } catch (e) {
      console.error('Erreur POST /realisations', e);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);


router.post(
  '/upload-document',
  authenticateToken,
  upload.single('document'),
  async (req, res) => {
    try {
      const userId = req.user.id
      const realisationId = Number(req.body.realisationId)
      if (!realisationId) {
        return res.status(400).json({ error: 'realisationId obligatoire' })
      }

      const file = req.file
      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'Fichier manquant' })
      }

      const existingReal = await prisma.realisation.findUnique({
        where: { id: realisationId, userId }
      })
      if (!existingReal) {
        return res.status(404).json({ error: 'Réalisation non trouvée' })
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'realisations' },
          (error, output) => (error ? reject(error) : resolve(output))
        )
        streamifier.createReadStream(file.buffer).pipe(stream)
      })

      const savedFile = await prisma.realisationFile.create({
        data: {
          realisationId,
          fileName: result.original_filename || file.originalname,
          publicId: (result.public_id || result.publicId || '').replace(/^realisations\//, ''),
          version: result.version ? parseInt(result.version, 10) : null,
          format: result.format || 'pdf',
          originalName: (file.originalname || 'SansNom').replace(/\s+/g, '_'),
        },
      })

      res.json({ success: true, file: savedFile, cloudinary: result })
    } catch (error) {
      console.error('Erreur upload document réalisation:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }
)

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id

    const rawRealisations = await prisma.realisation.findMany({
      where: { userId },
      include: {
        files: true,
        techs: true,
      },
    })

    const realisations = rawRealisations.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      techs: (r.techs || []).map(t => ({
        name: t.name,
        level: t.level,
      })),
      files: (r.files || []).map(f => ({
        id: f.id,
        publicId: f.publicId,
        version: f.version,
        format: f.format,
        originalName: (f.originalName || 'SansNom').replace(/\s+/g, '_'),
      })),
    }))

    res.json(realisations)
  } catch (err) {
    console.error('Erreur GET /realisations', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
