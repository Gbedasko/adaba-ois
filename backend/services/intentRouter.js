const db = require('../db');

// Static patterns — always checked first (fast, no DB call)
const STATIC_PATTERNS = {
  remittance: /remit|paid|transferred|sent.*k|transfer done/i,
  delivery:   /delivered|not picking|shifted|rts|return|dispatch|gbam|collected|customer collected/i,
  order:      /name:|phone number:|delivery address:|select.*cream|select.*pack|confirmed/i,
  issue:      /complaint|wrong item|refund|problem|missing/i,
  noise:      /^(ok|okay|noted|thanks|good|👍|🙏)$/i,
};

// Load learned intent patterns from training_rules table
async function loadLearnedPatterns() {
  try {
    const result = await db.query(
      `SELECT pattern, intent FROM training_rules 
       WHERE intent IS NOT NULL AND intent != ''
       ORDER BY created_at ASC`
    );
    return result.rows;
  } catch (err) {
    console.error('Could not load learned patterns:', err.message);
    return [];
  }
}

// Detect intent — checks static patterns first, then learned patterns
async function detectIntent(body) {
  const b = body.toLowerCase().trim();

  // Check noise first
  if (STATIC_PATTERNS.noise.test(b)) return 'noise';

  // Check static patterns
  for (const [intent, pattern] of Object.entries(STATIC_PATTERNS)) {
    if (intent === 'noise') continue;
    if (pattern.test(b)) return intent;
  }

  // Check learned patterns from database
  const learnedPatterns = await loadLearnedPatterns();
  for (const rule of learnedPatterns) {
    if (b.includes(rule.pattern.toLowerCase())) {
      return rule.intent;
    }
  }

  return 'unknown';
}

module.exports = { detectIntent };
