const cloudinary = require("cloudinary").v2;
const path = require("path");

cloudinary.config({
  cloud_name: "dwwt3sgbw",
  api_key: "798635284258412",
  api_secret: "FnnkTAgJo0wNZYFwwfMRPFMEsDQ"
});

const filePath = path.join(__dirname, "CV Freelance TAILHAN Céline.pdf");

cloudinary.uploader.upload(filePath, {
  resource_type: "raw", 
  public_id: "CV_Freelance_TAILHAN_CA_line"
})
.then(result => {
  console.log("✅ Upload réussi :", result.secure_url);
})
.catch(error => {
  console.error("❌ Erreur Cloudinary :", error);
});
