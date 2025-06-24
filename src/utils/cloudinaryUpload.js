const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

async function uploadDocument(buffer, originalName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: `realisations/${originalName}`, // ex: realisations/monfichier.pdf
        overwrite: true,
      },
      (err, result) => {
        if (err) reject(err)
        else resolve(result)
      }
    )
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: `profil/${originalName}`, // ex: profil/avatar.jpg
        overwrite: true,
      },
      (err, result) => {
        if (err) reject(err)
        else resolve(result)
      }
    )
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

module.exports = { uploadDocument, uploadImage }