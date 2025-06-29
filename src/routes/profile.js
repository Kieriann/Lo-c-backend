const express = require('express');
const router = express.Router();
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authenticateToken = require('../middlewares/authMiddleware');
const { uploadImage, uploadDocument, deleteFile } = require('../utils/cloudinary'); 

router.use(authenticateToken);

const upload = multer({ storage: multer.memoryStorage() });

      /* helper : ne plante jamais si la chaîne est vide / undefined */
const safeParse = (str, fallback = {}) => {
  try { return JSON.parse(str ?? ''); } catch { return fallback; }
};

router.post(
  '/profil',
upload.any(),
  async (req, res) => {
    try {
      const userId = req.user.id;



     const profileData     = safeParse(req.body.profile);
     const addressData     = safeParse(req.body.address);
     const experiencesData = safeParse(req.body.experiences,  []);
     const prestationsData = safeParse(req.body.prestations,  []);

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
          await prisma.document.delete({ where: { id: photoDoc.id } });
        }
      }

      if (req.body.removeCV === 'true') {
        const cvDoc = await prisma.document.findFirst({ where: { userId, type: 'cv' } });
        if (cvDoc) {
          await prisma.document.delete({ where: { id: cvDoc.id } });
        }
      }

      const photoFile = req.files?.find(f => f.fieldname === 'photo');
      const  cvFile   = req.files?.find(f => f.fieldname === 'cv');
      const realFiles = req.files?.filter(f => f.fieldname === 'files');

  



      if (photoFile && photoFile.buffer) {
        const result = await uploadImage(photoFile.buffer, photoFile.originalname);
        console.log('CLOUDINARY RESULT PHOTO', result); 
        await prisma.document.deleteMany({ where: { userId, type: 'ID_PHOTO' } });

        if (result.publicId && result.version && result.format) {
          console.log('OBJET ENVOYÉ À PRISMA PHOTO', {
  userId,
  type: 'ID_PHOTO',
  fileName: result.original_filename,
  originalName: result.original_filename,
  publicId: result.publicId,
  version: parseInt(result.version, 10),
  format: result.format,
});

          try {
await prisma.document.create({
  data: {
    userId,
    type: 'ID_PHOTO',
    fileName: result.original_filename,
    originalName: result.original_filename,
    publicId: result.publicId,
    version: parseInt(result.version, 10),
    format: result.format,
  },
});


          } catch (err) {
            await deleteFile(result.publicId); // nettoyage Cloudinary
            throw err;
          }
        }
      }

      if (cvFile && cvFile.buffer) {
  const result = await uploadDocument(cvFile.buffer, cvFile.originalname);
   console.log('CLOUDINARY RESULT CV', result);
  

  if (result.publicId && result.version && result.format) {
    await prisma.document.deleteMany({ where: { userId, type: 'cv' } }); // déplacer ici

    try {
      await prisma.document.create({
        data: {
          userId,
          type: 'cv',
          fileName: result.original_filename || cvFile.originalname || 'Sans nom',
          publicId: result.publicId,
          version: parseInt(result.version, 10),
          format: result.format,
          originalName: cvFile.originalname || result.original_filename || 'Sans nom'
        },
      });
    } catch (err) {
      await deleteFile(result.publicId); // nettoyage Cloudinary
      throw err;
    }
  }
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
        Documents: {
          select: {
            id: true,
            type: true,
            fileName: true,
            originalName: true,
            publicId: true,
            version: true,
            format: true,
          }
        },
        Experiences: true,
        Prestations: true,
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
    });
  } catch (err) {
    console.error('Erreur GET /profil', err);
    res.status(500).json({ error: 'Erreur serveur', details: err.message });
  }
});

module.exports = router;
