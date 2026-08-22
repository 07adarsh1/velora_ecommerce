/**
 * Cloudinary delivery-URL helper (docs/ui-prd.md §5): requests optimized
 * variants per context so the browser never downloads a full-size upload.
 * Non-Cloudinary URLs pass through untouched.
 */
export function cimg(url, { w = 800, h, fit = 'crop' } = {}) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const t = [`w_${w}`, h ? `h_${h}` : null, `c_${fit}`, 'q_auto', 'f_auto'].filter(Boolean).join(',');
  return url.replace('/upload/', `/upload/${t}/`);
}
