// src/utils/cloudinaryUpload.js
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

// Configuration de Cloudinary (assure-toi qu'elle est bien configurée ailleurs)
// cloudinary.config({ ... }) // Si pas déjà configuré dans ton app

async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    if (!buffer) {
      return reject(new Error('Buffer manquant'))
    }
    
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto", // Utilise "auto" au lieu de "image"
        folder: "profil",
        public_id: originalName.split('.')[0], // Sans extension
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

async function uploadDocument(buffer, originalName) {
  return new Promise((resolve, reject) => {
    if (!buffer) {
      return reject(new Error('Buffer manquant'))
    }
    
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",  // Utilise "raw" pour les documents
        folder: "realisations",
        public_id: originalName.split('.')[0], // Sans extension
        use_filename: true,
        overwrite: true
      },
      (error, result) => {
        if (error) {
          console.error("Erreur Cloudinary:", error)
          reject(error)
        } else {
          console.log("Réponse Cloudinary Document:", result.secure_url)
          resolve(result)
        }
      }
    )
    
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

module.exports = { uploadImage, uploadDocument }