function detectIntent(body) {
  const b = body.toLowerCase();
  if (/remit|paid|transferred|sent.*k|transfer done/.test(b)) return 'remittance';
  if (/delivered|not picking|shifted|rts|return|dispatch/.test(b))  return 'delivery';
  if (/order|confirmed|customer.*want|placed/.test(b))               return 'order';
  if (/complaint|wrong item|refund|problem|missing/.test(b))         return 'issue';
  if (/^(ok|okay|noted|thanks|good|\uD83D\uDC4D|\uD83D\uDE4F)$/i.test(b.trim()))        return 'noise';
  return 'unknown';
}

module.exports = { detectIntent };
