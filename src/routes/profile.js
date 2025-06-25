const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('../middlewares/authMiddleware');
const cloudinary = require('../utils/cloudinaryUpload');

router.use(authenticateToken);

const upload = multer({ storage: multer.memoryStorage() });

const uploadBufferToCloudinary = (fileBuffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve(result);
    });
    uploadStream.end(fileBuffer);
  });
};

router.post(
  '/profil',
  upload.fields([
    { name: 'photo' },
    { name: 'cv' },
    { name: 'realFiles' }
  ]),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const profileData = JSON.parse(req.body.profile);
      const addressData = JSON.parse(req.body.address);
      const experiencesData = JSON.parse(req.body.experiences);
      const prestationsData = JSON.parse(req.body.prestations);

      const { availableDate, ...restProfile } = profileData;
      const availableDateParsed = availableDate ? new Date(availableDate) : undefined;

      const profile = await prisma.profile.upsert({
        where: { userId },
        update: { ...restProfile, ...(availableDateParsed && { availableDate: availableDateParsed }) },
        create: { ...restProfile, ...(availableDateParsed && { availableDate: availableDateParsed }), userId }
      });

      await prisma.address.upsert({
        where: { profileId: profile.id },
        update: { ...addressData },
        create: { ...addressData, profileId: profile.id }
      });

      await prisma.experience.deleteMany({ where: { userId } });
      for (const exp of experiencesData) {
        await prisma.experience.create({
          data: {
            title: exp.title,
            client: exp.client || '',
            description: exp.description,
            domains: exp.domains || '',
            skills: JSON.stringify(exp.skills || []),
            languages: Array.isArray(exp.languages) ? exp.languages : [],
            userId
          }
        });
      }

      await prisma.prestation.deleteMany({ where: { userId } });
      for (const p of prestationsData) {
        await prisma.prestation.create({ data: { ...p, userId } });
      }

      if (req.body.removePhoto === 'true') {
        const photoDoc = await prisma.document.findFirst({ where: { userId, type: 'ID_PHOTO' } });
        if (photoDoc) {
          await cloudinary.uploader.destroy(photoDoc.public_id);
          await prisma.document.delete({ where: { id: photoDoc.id } });
        }
      }

      if (req.body.removeCV === 'true') {
        const cvDoc = await prisma.document.findFirst({ where: { userId, type: 'CV' } });
        if (cvDoc) {
          await cloudinary.uploader.destroy(cvDoc.public_id, { resource_type: 'raw' });
          await prisma.document.delete({ where: { id: cvDoc.id } });
        }
      }

      const photoFile = req.files?.photo?.[0];
      const cvFile = req.files?.cv?.[0];

      if (photoFile && photoFile.buffer) {
        const result = await uploadBufferToCloudinary(photoFile.buffer, {
          folder: `user_files/${userId}`,
          resource_type: 'image'
        });
        await prisma.document.deleteMany({ where: { userId, type: 'ID_PHOTO' } });
        await prisma.document.create({
          data: {
            userId,
            type: 'ID_PHOTO',
            public_id: result.public_id,
            version: String(result.version),
            format: result.format,
            originalName: photoFile.originalname
          }
        });
      }

      if (cvFile && cvFile.buffer) {
        const result = await uploadBufferToCloudinary(cvFile.buffer, {
          folder: `user_files/${userId}`,
          resource_type: 'raw'
        });
        await prisma.document.deleteMany({ where: { userId, type: 'CV' } });
        await prisma.document.create({
          data: {
            userId,
            type: 'CV',
            public_id: result.public_id,
            version: String(result.version),
            format: result.format,
            originalName: cvFile.originalname
          }
        });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("ERREUR DANS L'UPLOAD DU PROFIL :", err);
      res.status(500).json({ error: 'Erreur serveur', details: err.message });
    }
  }
);

router.get('/profil', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        Profile: { include: { Address: true } },
        Documents: true,
        Experiences: true,
        Prestations: true,
        realisations: {
          include: {
            files: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      isAdmin: user.isAdmin,
      profile: user.Profile,
      experiences: user.Experiences,
      documents: user.Documents,
      prestations: user.Prestations,
      realisations: user.realisations
    });
  } catch (err) {
    console.error('Erreur GET /profil', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;