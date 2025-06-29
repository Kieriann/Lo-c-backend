// ./utils/cloudinary.js
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

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
function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    if (!buffer)          return reject(new Error('Buffer manquant'));
    if (!isValidImageBuffer(buffer))
      return reject(new Error('Buffer invalide : pas une image'));

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder       : 'profil',
        public_id    : originalName.split('.')[0],
        overwrite    : true,
      },
      (err, res) => (err ? reject(err) : resolve({ ...res, publicId: res.public_id }))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function uploadDocument(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'cv', public_id: filename },
      (err, res) => (err ? reject(err) : resolve({ ...res, publicId: res.public_id }))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/* ─────── delete ────────────────────────────────────────── */
async function deleteFile(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
}

/* ─────── exports ───────────────────────────────────────── */
module.exports = {
  cloudinary,      // pour accéder à upload_stream ailleurs
  uploadImage,
  uploadDocument,
  deleteFile,
};
