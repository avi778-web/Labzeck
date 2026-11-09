const crypto = require("crypto");
const https = require("https");

function cloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function createSignature(params) {
  const payload = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${process.env.CLOUDINARY_API_SECRET}`).digest("hex");
}

function uploadToCloudinary(dataUrl, { folder = "sk-graphics/artwork", publicId } = {}) {
  if (!cloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp, ...(publicId ? { public_id: publicId } : {}) };
  const form = new URLSearchParams({ file: dataUrl, api_key: process.env.CLOUDINARY_API_KEY, ...params, signature: createSignature(params) }).toString();
  const options = {
    hostname: "api.cloudinary.com",
    path: `/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/auto/upload`,
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(form) }
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch (_) { parsed = null; }
        if (response.statusCode < 200 || response.statusCode >= 300 || !parsed?.secure_url) {
          const error = new Error(parsed?.error?.message || "Cloudinary upload failed");
          error.statusCode = response.statusCode || 502;
          reject(error);
          return;
        }
        resolve({ secureUrl: parsed.secure_url, publicId: parsed.public_id, resourceType: parsed.resource_type, format: parsed.format, bytes: parsed.bytes });
      });
    });
    request.setTimeout(120000, () => request.destroy(new Error("Cloudinary upload timed out")));
    request.on("error", reject);
    request.write(form);
    request.end();
  });
}

module.exports = { cloudinaryConfigured, uploadToCloudinary };
