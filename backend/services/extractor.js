const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const WHATSAPP_TOKEN = process.env.ACCESS_TOKEN;

const SCHEMAS = {
  order: {
    name: 'order_extraction',
    schema: {
      type: 'object',
      properties: {
        customer_name:  { type: ['string','null'] },
        customer_phone: { type: ['string','null'] },
        product:        { type: ['string','null'] },
        quantity:       { type: ['integer','null'] },
        selling_price:  { type: ['number','null'] },
        state:          { type: ['string','null'] },
        csr_name:       { type: ['string','null'] }
      },
      required: ['customer_name','customer_phone','product','quantity','selling_price','state','csr_name'],
      additionalProperties: false
    }
  },
  remittance: {
    name: 'remittance_extraction',
    schema: {
      type: 'object',
      properties: {
        reported_amount: { type: ['number','null'] },
        state:           { type: ['string','null'] },
        payment_method:  { type: ['string','null'] },
        batch_ref:       { type: ['string','null'] },
        sender_name:     { type: ['string','null'] }
      },
      required: ['reported_amount','state','payment_method','batch_ref','sender_name'],
      additionalProperties: false
    }
  },
  delivery: {
    name: 'delivery_extraction',
    schema: {
      type: 'object',
      properties: {
        event_type:        { type: ['string','null'] },
        logistics_partner: { type: ['string','null'] },
        failure_reason:    { type: ['string','null'] },
        batch_ref:         { type: ['string','null'] },
        state:             { type: ['string','null'] }
      },
      required: ['event_type','logistics_partner','failure_reason','batch_ref','state'],
      additionalProperties: false
    }
  }
};

const SYSTEM_PROMPT = `You are an extraction AI for Adaba Global Ventures, a Nigerian e-commerce company.
Extract structured data from WhatsApp operational messages.
Nigerian context: ABJ=Abuja, LGS/LG=Lagos, PH=Port Harcourt, KN=Kano.
Amounts: 54k=54000, 1.2m=1200000. RTS=return to sender. POD=pay on delivery.
Return null for fields you cannot find. Never omit required fields.`;

async function extract(intent, message, groupName, senderName) {
  const schemaConfig = SCHEMAS[intent];
  if (!schemaConfig) return null;

  const res = await client.chat.completions.create({
    model: 'gpt-4.1',
    temperature: 0,
    max_tokens: 400,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Group: ${groupName}\nSender: ${senderName}\nMessage: ${message}` }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaConfig.name,
        strict: true,
        schema: schemaConfig.schema
      }
    }
  });

  return JSON.parse(res.choices[0].message.content);
}

module.exports = { extract };
