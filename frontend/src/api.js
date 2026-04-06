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
