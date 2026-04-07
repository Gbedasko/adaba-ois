const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const get = (path) => fetch(`${BASE}${path}`).then(r => r.json())

export const api = {
  dailySummary:       (date)     => get(`/api/intelligence/daily-summary${date ? `?date=${date}` : ''}`),
  csrPerformance:     (from, to) => get(`/api/intelligence/csr-performance?from=${from}&to=${to}`),
  productPerformance: (from, to) => get(`/api/intelligence/product-performance?from=${from}&to=${to}`),
  groupPerformance:   (from, to) => get(`/api/intelligence/group-performance?from=${from}&to=${to}`),
  revenueTrend:       (days)     => get(`/api/intelligence/revenue-trend?days=${days}`),
  remittanceSummary:  (from, to) => get(`/api/intelligence/remittance-summary?from=${from}&to=${to}`),
  orders:             (params)   => get(`/api/intelligence/orders?${new URLSearchParams(params)}`),
  unknownMessages:    ()         => get(`/api/learning/unknown`),
  trainingRules:      ()         => get(`/api/learning/rules`),
  teachRule:          (body)     => fetch(`${BASE}/api/learning/teach`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(body)
                                    }).then(r => r.json()),
}
