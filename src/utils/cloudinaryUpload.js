const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

// Vérifie si le buffer correspond bien à une image valide (simple vérification magique number JPEG/PNG)
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 4) return false

  // JPEG : FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true
  // PNG : 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) return true
  // GIF : 47 49 46 38
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) return true

  return false
}

// Upload d'image (photo)
async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    if (!buffer) return reject(new Error('Buffer manquant'))
    if (!isValidImageBuffer(buffer)) return reject(new Error('Buffer image invalide (pas une image reconnue)'))

    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'profil',
        public_id: originalName.split('.')[0],
        overwrite: true
      },
      (error, result) => {
        if (error) {
          console.error("Erreur Cloudinary:", error)
          reject(error)
        } else {
          console.log("Réponse Cloudinary Image:", result.secure_url)
          resolve(result)
        }
      }
    )

    streamifier.createReadStream(buffer).pipe(stream)
  })
}

// Upload de document (CV, PDF...)
function uploadDocument(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: `cv/${filename}`,
        resource_type: 'raw',
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      }
    )
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

module.exports = { uploadImage, uploadDocument }