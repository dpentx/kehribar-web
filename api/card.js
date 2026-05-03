const VIDEO_ID = "EzeJVk0gDZ4";
const TRACK = "\u30B9\u30D7\u30FC\u30C8\u30CB\u30AF";
const ARTIST = "LOLUET";
const LINK = "https://music.youtube.com/watch?v=" + VIDEO_ID;
const THUMB = `https://img.youtube.com/vi/${VIDEO_ID}/mqdefault.jpg`;

export default async function handler(req, res) {
  let imgBase64 = "";
  try {
    const r = await fetch(THUMB);
    const buf = await r.arrayBuffer();
    imgBase64 = Buffer.from(buf).toString("base64");
  } catch (_) {}

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="380" height="80" viewBox="0 0 380 80">
  <defs>
    <clipPath id="thumb-clip">
      <rect x="12" y="10" width="60" height="60" rx="6"/>
    </clipPath>
    <clipPath id="card-clip">
      <rect width="380" height="80" rx="12"/>
    </clipPath>
  </defs>

  <!-- background -->
  <rect width="380" height="80" rx="12" fill="#2d353b"/>

  <!-- thumbnail -->
  ${imgBase64
    ? `<image href="data:image/jpeg;base64,${imgBase64}" x="12" y="10" width="60" height="60" clip-path="url(#thumb-clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="12" y="10" width="60" height="60" rx="6" fill="#343f44"/>`
  }

  <!-- track name -->
  <text x="86" y="35" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="15" font-weight="600" fill="#d3c6aa">${TRACK}</text>

  <!-- artist -->
  <text x="86" y="54" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="#859289">${ARTIST}</text>

  <!-- play button -->
  <circle cx="349" cy="40" r="18" fill="#a7c080"/>
  <polygon points="344,32 344,48 358,40" fill="#2d353b"/>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(svg);
    }
