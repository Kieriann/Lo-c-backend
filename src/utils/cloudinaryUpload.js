const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

async function uploadDocument(buffer, originalName) {
  return new Promise((resolve, reject) => {
    // Extraire l'extension depuis le nom original
    const extension = originalName.split('.').pop().toLowerCase()
    
    // Créer un nom de fichier sans l'extension pour public_id
    const baseFileName = originalName.replace(/\.[^/.]+$/, "")
    
    // Configuration de l'upload avec l'extension explicite
    const uploadOptions = {
      resource_type: "raw",
      public_id: `realisations/${baseFileName}`,
      format: extension,  // Spécifier explicitement le format
      overwrite: true
    }
    
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Erreur Cloudinary:", error)
          reject(error)
        } else {
          console.log("Réponse Cloudinary:", JSON.stringify(result, null, 2))
          resolve(result)
        }
      }
    )
    
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    // Extraire l'extension depuis le nom original
    const extension = originalName.split('.').pop().toLowerCase()
    
    // Créer un nom de fichier sans l'extension pour public_id
    const baseFileName = originalName.replace(/\.[^/.]+$/, "")
    
    const uploadOptions = {
      resource_type: "image",
      public_id: `profil/${baseFileName}`,
      overwrite: true
    }
    
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("Erreur Cloudinary:", error)
          reject(error)
        } else {
          console.log("Réponse Cloudinary:", JSON.stringify(result, null, 2))
          resolve(result)
        }
      }
    )
    
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

module.exports = { uploadDocument, uploadImage }