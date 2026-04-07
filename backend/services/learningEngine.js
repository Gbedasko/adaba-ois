const db = require('../db');

// Load all training rules from database
async function loadTrainingRules() {
  const result = await db.query(
    'SELECT * FROM training_rules ORDER BY created_at ASC'
  );
  return result.rows;
}

// Build dynamic prompt additions from training rules
async function buildDynamicPrompt(intent) {
  const rules = await loadTrainingRules();
  const intentRules = rules.filter(r => !r.intent || r.intent === intent);

  if (intentRules.length === 0) return '';

  let dynamicSection = '\n\nLEARNED RULES (from human corrections):\n';
  for (const rule of intentRules) {
    dynamicSection += `- ${rule.pattern} means: ${rule.meaning}`;
    if (rule.example_input) {
      dynamicSection += ` (example: "${rule.example_input}")`;
    }
    dynamicSection += '\n';
  }
  return dynamicSection;
}

// Flag a message the AI could not understand
async function flagUnknownMessage(rawMessageId, body, senderName, groupName, reason) {
  await db.query(
    `INSERT INTO unknown_messages 
      (raw_message_id, body, sender_name, group_name, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [rawMessageId, body, senderName, groupName, reason]
  );
}

// Save a correction as a new training rule
async function saveTrainingRule({ ruleType, pattern, meaning, intent, field, value, exampleInput }) {
  await db.query(
    `INSERT INTO training_rules 
      (rule_type, pattern, meaning, intent, field, value, example_input)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [ruleType, pattern, meaning, intent, field, value, exampleInput]
  );
}

module.exports = { loadTrainingRules, buildDynamicPrompt, flagUnknownMessage, saveTrainingRule };
