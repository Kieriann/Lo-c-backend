// src/utils/cloudinaryUpload.js
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

// Upload d'image (photo)
async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    if (!buffer) return reject(new Error('Buffer manquant'))

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
