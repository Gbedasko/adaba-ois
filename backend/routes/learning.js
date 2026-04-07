const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { saveTrainingRule } = require('../services/learningEngine');

// GET all unknown/flagged messages
router.get('/unknown', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.*, r.body as full_body 
       FROM unknown_messages u
       LEFT JOIN raw_messages r ON u.raw_message_id = r.id
       WHERE u.status = 'pending'
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a training rule (teach the AI something new)
router.post('/teach', async (req, res) => {
  try {
    const { pattern, meaning, intent, field, value, exampleInput, unknownMessageId } = req.body;

    await saveTrainingRule({
      ruleType: 'learned',
      pattern, meaning, intent, field, value,
      exampleInput
    });

    // Mark the unknown message as resolved
    if (unknownMessageId) {
      await db.query(
        `UPDATE unknown_messages SET status = 'resolved' WHERE id = $1`,
        [unknownMessageId]
      );
    }

    res.json({ success: true, message: 'Rule saved. AI will use this from next extraction.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all training rules
router.get('/rules', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM training_rules ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST correction on an already-extracted record
router.post('/correct', async (req, res) => {
  try {
    const { rawMessageId, fieldCorrected, originalValue, correctedValue, correctionNote } = req.body;

    await db.query(
      `INSERT INTO extraction_feedback
        (raw_message_id, field_corrected, correction_note)
       VALUES ($1, $2, $3)`,
      [rawMessageId, fieldCorrected, correctionNote]
    );

    // Auto-create a training rule from correction
    await saveTrainingRule({
      ruleType:     'correction',
      pattern:      `When you see "${originalValue}"`,
      meaning:      `it means "${correctedValue}"`,
      intent:       null,
      field:        fieldCorrected,
      value:        correctedValue,
      exampleInput: correctionNote
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
