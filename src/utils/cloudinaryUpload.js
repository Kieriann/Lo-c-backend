const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false;

  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) return true;
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) return true;

  return false;
}

async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    if (!buffer) return reject(new Error('Buffer manquant'));
    if (!isValidImageBuffer(buffer)) return reject(new Error('Buffer image invalide (pas une image reconnue)'));

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'profil',
        publicId: originalName.split('.')[0],
        overwrite: true
      },
      (error, result) => {
        if (error) {
          console.error("Erreur Cloudinary:", error);
          reject(error);
        } else {
          console.log("Réponse Cloudinary Image:", result.secure_url);
          resolve(result);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function uploadDocument(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        publicId: `cv/${filename}`,
        resource_type: 'raw',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function deleteFile(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
  } catch (err) {
    console.error("Erreur lors de la suppression Cloudinary :", err);
  }
}

module.exports = { uploadImage, uploadDocument, deleteFile };
