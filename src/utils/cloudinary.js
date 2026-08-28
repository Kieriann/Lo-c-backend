// ./utils/cloudinary.js
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');
const crypto = require('crypto');

/* ─────── config ─────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key   : process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ─────── helpers ────────────────────────────────────────── */
function isValidImageBuffer(buf) {
  if (!buf || buf.length < 4) return false;
  return (
    // JPEG
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    // PNG
    (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
    // GIF
    (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
  );
}

/* ─────── uploads ───────────────────────────────────────── */
function uploadImage(buffer, userId) {
  return new Promise((resolve, reject) => {
    if (!buffer)          return reject(new Error('Buffer manquant'));
    if (!isValidImageBuffer(buffer))
      return reject(new Error('Buffer invalide : pas une image'));

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        type         : 'authenticated',
        folder       : `profil/${Number(userId)}`,
        public_id    : crypto.randomUUID(),
        overwrite    : false,
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
      },
      (err, res) => (err ? reject(err) : resolve({ ...res, publicId: res.public_id }))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function uploadDocument(buffer, userId) {
  return new Promise((resolve, reject) => {
    if (!buffer || buffer.length < 5 || buffer.subarray(0, 5).toString() !== '%PDF-') {
      return reject(new Error('Le CV doit être un fichier PDF valide'));
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        type: 'authenticated',
        folder: `cv/${Number(userId)}`,
        public_id: crypto.randomUUID(),
        overwrite: false,
      },
      (err, res) => (err ? reject(err) : resolve({ ...res, publicId: res.public_id }))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* ─────── delete ────────────────────────────────────────── */
async function deleteFile(publicId, resourceType = 'image', deliveryType = 'upload') {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: deliveryType });
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
}

function assetUrl({ publicId, resourceType = 'image', deliveryType = 'upload', version, format }) {
  if (!publicId) return null;
  const authenticated = deliveryType === 'authenticated';
  if (authenticated) {
    return cloudinary.utils.private_download_url(publicId, format || (resourceType === 'raw' ? 'pdf' : 'jpg'), {
      resource_type: resourceType,
      type: deliveryType,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      attachment: false,
    });
  }
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: resourceType,
    type: deliveryType,
    version: version || undefined,
    format: format || undefined,
  });
}

/* ─────── exports ───────────────────────────────────────── */
module.exports = {
  cloudinary,      // pour accéder à upload_stream ailleurs
  uploadImage,
  uploadDocument,
  deleteFile,
  assetUrl,
};
