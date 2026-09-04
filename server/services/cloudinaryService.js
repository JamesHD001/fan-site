const crypto = require("crypto");

const CLOUDINARY_UPLOAD_URL = () =>
  `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;

const createSignature = (params) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${process.env.CLOUDINARY_API_SECRET}`)
    .digest("hex");
};

const uploadPostImage = async (dataUri) => {
  if (!dataUri) return "";

  const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    const error = new Error("Image uploads are not configured on the server.");
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }

  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUri)) {
    const error = new Error("Only JPEG, PNG, and WebP images are supported.");
    error.code = "INVALID_IMAGE_FORMAT";
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "keanu-fan-community/posts";
  const params = { folder, timestamp };
  const body = new URLSearchParams({
    file: dataUri,
    api_key: process.env.CLOUDINARY_API_KEY,
    timestamp: String(timestamp),
    folder,
    signature: createSignature(params),
  });

  const response = await fetch(CLOUDINARY_UPLOAD_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const result = await response.json();
  if (!response.ok || !result.secure_url) {
    const error = new Error(result?.error?.message || "Unable to upload image.");
    error.code = "IMAGE_UPLOAD_FAILED";
    throw error;
  }

  return result.secure_url;
};

module.exports = { uploadPostImage };
