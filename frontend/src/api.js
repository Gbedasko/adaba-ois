const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function fetchSummary() {
  const res = await fetch(`${BASE}/api/dashboard/summary`)
  if (!res.ok) throw new Error('Failed to fetch summary')
  return res.json()
}

export async function fetchOrders() {
  const res = await fetch(`${BASE}/api/orders`)
  if (!res.ok) throw new Error('Failed to fetch orders')
  return res.json()
}

export async function fetchRemittances() {
  const res = await fetch(`${BASE}/api/remittances`)
  if (!res.ok) throw new Error('Failed to fetch remittances')
  return res.json()
}

export async function fetchUnknownMessages() {
  const res = await fetch(`${BASE}/api/learning/unknown`)
  if (!res.ok) throw new Error('Failed to fetch unknown messages')
  return res.json()
}

export async function fetchTrainingRules() {
  const res = await fetch(`${BASE}/api/learning/rules`)
  if (!res.ok) throw new Error('Failed to fetch training rules')
  return res.json()
}

export async function teachAI({ pattern, meaning, intent, field, value, exampleInput, unknownMessageId }) {
  const res = await fetch(`${BASE}/api/learning/teach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pattern, meaning, intent, field, value, exampleInput, unknownMessageId })
  })
  if (!res.ok) throw new Error('Failed to save training rule')
  return res.json()
}

export async function correctExtraction({ rawMessageId, fieldCorrected, originalValue, correctedValue, correctionNote }) {
  const res = await fetch(`${BASE}/api/learning/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawMessageId, fieldCorrected, originalValue, correctedValue, correctionNote })
  })
  if (!res.ok) throw new Error('Failed to save correction')
  return res.json()
}
