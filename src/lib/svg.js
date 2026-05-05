// ─── Sharable image generators ────────────────────────────────────
// Generate beautiful PNG cards for sharing via iOS share sheet.

import { calcAge } from './dates.js';

function escapeXml(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  );
}

function wrapText(text, maxChars) {
  if (!text) return [];
  const out = [];
  for (const para of text.split(/\n+/)) {
    const words = para.split(/\s+/);
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

// ─── Sitter Card ──────────────────────────────────────────────────
export function buildSitterCardSVG(girls, household, sitterNotes) {
  const W = 800;
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const lines = [];
  let y = 90;

  lines.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-size="22" letter-spacing="8" fill="#B8857B">MAISON</text>`);
  y += 60;
  lines.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-style="italic" font-size="44" fill="#2A241D">For the Sitter</text>`);
  y += 32;
  lines.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="'DM Sans',system-ui,sans-serif" font-size="11" letter-spacing="3" fill="#8E7B6E">${escapeXml(dateStr.toUpperCase())}</text>`);
  y += 40;
  lines.push(`<line x1="80" x2="${W - 80}" y1="${y}" y2="${y}" stroke="#B8857B" stroke-opacity="0.35" stroke-width="1" />`);
  y += 50;

  for (const g of girls) {
    const age = calcAge(g.birthday);
    const initial = (g.name || '?').charAt(0);

    lines.push(`<circle cx="118" cy="${y + 16}" r="34" fill="#B8857B" fill-opacity="0.18" />`);
    lines.push(`<text x="118" y="${y + 28}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-style="italic" font-size="34" fill="#8B5A4F">${escapeXml(initial)}</text>`);

    lines.push(`<text x="172" y="${y + 8}" font-family="'Fraunces',Georgia,serif" font-size="30" fill="#2A241D">${escapeXml(g.name)}</text>`);
    lines.push(`<text x="172" y="${y + 32}" font-family="'DM Sans',system-ui,sans-serif" font-size="11" letter-spacing="2" fill="#8E7B6E">${escapeXml(age.toUpperCase())}</text>`);
    y += 70;

    const bday = g.birthday
      ? new Date(g.birthday + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
    const fields = [
      ['BIRTHDAY', bday],
      ['CLOTHES', g.clothes],
      ['SHOE', g.shoe],
      ['DIAPER', g.diaper],
      ['ALLERGIES', g.allergies],
    ];
    for (const [k, v] of fields) {
      if (!v) continue;
      lines.push(`<text x="120" y="${y}" font-family="'Fraunces',Georgia,serif" font-size="10" letter-spacing="2" fill="#B8857B">${k}</text>`);
      lines.push(`<text x="260" y="${y}" font-family="'DM Sans',system-ui,sans-serif" font-size="15" fill="#2A241D">${escapeXml(v)}</text>`);
      y += 26;
    }
    y += 16;
    lines.push(`<line x1="80" x2="${W - 80}" y1="${y}" y2="${y}" stroke="#B8857B" stroke-opacity="0.30" stroke-width="1" />`);
    y += 44;
  }

  if (household && household.length) {
    const hasAny = household.some((h) => h.value);
    if (hasAny) {
      lines.push(`<text x="120" y="${y}" font-family="'DM Sans',system-ui,sans-serif" font-size="11" letter-spacing="3" fill="#8E7B6E">IF YOU NEED IT</text>`);
      y += 32;
      for (const h of household) {
        if (!h.value) continue;
        lines.push(`<text x="120" y="${y}" font-family="'Fraunces',Georgia,serif" font-size="10" letter-spacing="2" fill="#B8857B">${escapeXml((h.key || '').toUpperCase())}</text>`);
        lines.push(`<text x="260" y="${y}" font-family="'DM Sans',system-ui,sans-serif" font-size="15" fill="#2A241D">${escapeXml(h.value)}</text>`);
        y += 26;
      }
      y += 16;
    }
  }

  if (sitterNotes && sitterNotes.trim()) {
    lines.push(`<line x1="80" x2="${W - 80}" y1="${y}" y2="${y}" stroke="#B8857B" stroke-opacity="0.30" stroke-width="1" />`);
    y += 44;
    lines.push(`<text x="120" y="${y}" font-family="'DM Sans',system-ui,sans-serif" font-size="11" letter-spacing="3" fill="#8E7B6E">NOTES</text>`);
    y += 30;
    const wrapped = wrapText(sitterNotes, 60);
    for (const ln of wrapped) {
      lines.push(`<text x="120" y="${y}" font-family="'Fraunces',Georgia,serif" font-style="italic" font-size="16" fill="#2A241D">${escapeXml(ln)}</text>`);
      y += 24;
    }
    y += 12;
  }

  y += 36;
  lines.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-size="10" letter-spacing="6" fill="#B8857B" fill-opacity="0.7">M A I S O N</text>`);

  const H = y + 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FBF3EC" />
    <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="#B8857B" stroke-opacity="0.20" stroke-width="1" rx="8" />
    ${lines.join('\n')}
  </svg>`;
}

// ─── Moment Share Card (1080×... square-ish, social-friendly) ─────
export function buildMomentSVG(moment, photoDataUrl, photoDims) {
  const W = 1080;
  const PAD = 64;
  const innerW = W - PAD * 2;

  let photoH = 0;
  let photoBlock = '';
  if (photoDataUrl) {
    const aspect = photoDims && photoDims.h ? photoDims.h / photoDims.w : 1;
    photoH = Math.min(innerW * aspect, innerW * 1.1);
    photoBlock = `<image href="${photoDataUrl}" x="${PAD}" y="${PAD + 80}" width="${innerW}" height="${photoH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)" />`;
  }

  const photoBottom = PAD + 80 + photoH;
  const captionLines = wrapText(moment.text || '', 38);
  const captionStartY = photoBottom + (photoDataUrl ? 80 : 40);
  const lineH = 60;
  const captionH = captionLines.length * lineH;

  const captionEls = captionLines
    .map(
      (ln, i) =>
        `<text x="${W / 2}" y="${captionStartY + i * lineH}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-size="44" fill="#2A241D">${escapeXml(ln)}</text>`
    )
    .join('\n');

  const dateY = captionStartY + captionH + 56;
  const footerY = dateY + 80;
  const H = footerY + 60;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <clipPath id="photoClip">
        <rect x="${PAD}" y="${PAD + 80}" width="${innerW}" height="${photoH}" rx="20" />
      </clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="#FBF3EC" />
    <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="#B8857B" stroke-opacity="0.22" stroke-width="1.5" rx="12" />
    <text x="${W / 2}" y="${PAD + 36}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-size="22" letter-spacing="10" fill="#B8857B">MAISON</text>
    ${photoBlock}
    ${captionEls}
    <line x1="${W / 2 - 40}" x2="${W / 2 + 40}" y1="${dateY - 28}" y2="${dateY - 28}" stroke="#B8857B" stroke-opacity="0.40" stroke-width="1" />
    <text x="${W / 2}" y="${dateY}" text-anchor="middle" font-family="'DM Sans',system-ui,sans-serif" font-size="18" letter-spacing="6" fill="#8E7B6E">${escapeXml((moment.date || '').toUpperCase())}</text>
    <text x="${W / 2}" y="${footerY}" text-anchor="middle" font-family="'Fraunces',Georgia,serif" font-style="italic" font-size="20" fill="#B8857B" fill-opacity="0.7">a moment from maison</text>
  </svg>`;
}

// ─── Convert SVG → PNG → File for sharing ─────────────────────────
export function getImageDims(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

export async function svgToPngFile(svgString, filename) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const wMatch = svgString.match(/<svg[^>]+width="(\d+)"/);
        const hMatch = svgString.match(/<svg[^>]+height="(\d+)"/);
        const w = wMatch ? parseInt(wMatch[1]) : 800;
        const h = hMatch ? parseInt(hMatch[1]) : 1100;
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return reject(new Error('Canvas export failed'));
          resolve({
            file: new File([pngBlob], filename, { type: 'image/png' }),
            blob: pngBlob,
          });
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Native share if available, otherwise download fallback.
export async function shareOrDownload(svgString, filename, title) {
  const { file, blob } = await svgToPngFile(svgString, filename);
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || filename });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return 'downloaded';
}
