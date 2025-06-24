const cloudinary = require('cloudinary').v2

async function uploadDocument(filePath, originalName) {
  return cloudinary.uploader.upload(filePath, {
    resource_type: "raw",
    public_id: `realisations/${originalName}`, // ex: realisations/monfichier.pdf
    overwrite: true,
  })
}

async function uploadImage(filePath, originalName) {
  return cloudinary.uploader.upload(filePath, {
    resource_type: "image",
    public_id: `profil/${originalName}`, // ex: profil/avatar.jpg
    overwrite: true,
  })
}

module.exports = { uploadDocument, uploadImage }