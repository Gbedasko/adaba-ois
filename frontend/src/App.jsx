import { useState, useEffect } from 'react'
import { fetchSummary, fetchOrders, fetchRemittances } from './api.js'

const fmt = (n) => '₦' + Number(n).toLocaleString('en-NG')
const fmtDate = (d) => new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })

const STATUS_COLOR = {
  DELIVERED:  { bg: '#10b98120', text: '#10b981' },
  PENDING:    { bg: '#f59e0b20', text: '#f59e0b' },
  DISPATCHED: { bg: '#6366f120', text: '#6366f1' },
  FAILED:     { bg: '#ef444420', text: '#ef4444' },
}

function KpiCard({ label, value, sub, color = '#10b981' }) {
  return (
    <div style={{ background: '#1e293b', border: `1px solid ${color}44`, borderTop: `3px solid ${color}`, borderRadius: 10, padding: '16px 20px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
      <p style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{sub}</p>}
    </div>
  )
}

function SourceMsg({ msg }) {
  const [show, setShow] = useState(false)
  return (
    <span>
      <button onClick={() => setShow(!show)} style={{ fontSize: 10, padding: '2px 6px', background: '#334155', border: 'none', borderRadius: 3, color: '#94a3b8', cursor: 'pointer' }}>
        {show ? 'hide' : 'source'}
      </button>
      {show && <div style={{ marginTop: 4, fontSize: 11, color: '#fcd34d', background: '#0f172a', padding: '4px 8px', borderRadius: 4, fontStyle: 'italic' }}>"{msg}"</div>}
    </span>
  )
}

function DashboardPage({ summary, loading }) {
  if (loading) return <p style={{ color: '#64748b' }}>Loading...</p>
  if (!summary) return <p style={{ color: '#ef4444' }}>Could not load summary. Check backend connection.</p>
  const { orders, remittances, deliveries, messages_today } = summary
  const total = Number(deliveries.delivered) + Number(deliveries.failed)
  const rate  = total > 0 ? Math.round((deliveries.delivered / total) * 100) : 0
  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Live summary — today's operations</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <KpiCard label="Total Orders"     value={orders.total}          sub={`${orders.delivered} delivered · ${orders.pending} pending`} color="#f59e0b" />
        <KpiCard label="Delivery Rate"    value={`${rate}%`}            sub={`${deliveries.failed} failed`}   color="#10b981" />
        <KpiCard label="Total Remittance" value={fmt(remittances.total)} sub="reported via WhatsApp"           color="#6366f1" />
        <KpiCard label="Messages Today"   value={messages_today}         sub="received from groups"            color="#0ea5e9" />
      </div>
    </div>
  )
}

function OrdersPage({ orders, loading }) {
  if (loading) return <p style={{ color: '#64748b' }}>Loading...</p>
  if (!orders?.length) return <p style={{ color: '#64748b' }}>No orders yet.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>{orders.length} orders</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            {['Customer','Product','Qty','Price','State','CSR','Status','Date','Source'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const c = STATUS_COLOR[o.order_status] || { bg: '#33415520', text: '#94a3b8' }
            return (
              <tr key={o.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#ffffff05' }}>
                <td style={{ padding: '9px 12px', color: '#f8fafc', fontWeight: 600 }}>{o.customer_name || '—'}</td>
                <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{o.product || '—'}</td>
                <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{o.quantity || '—'}</td>
                <td style={{ padding: '9px 12px', color: '#10b981', fontWeight: 600 }}>{o.selling_price ? fmt(o.selling_price) : '—'}</td>
                <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{o.state || '—'}</td>
                <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{o.csr_name || '—'}</td>
                <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.text, fontWeight: 700 }}>{o.order_status}</span></td>
                <td style={{ padding: '9px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
                <td style={{ padding: '9px 12px' }}>{o.source_message ? <SourceMsg msg={o.source_message} /> : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RemittancesPage({ remittances, loading }) {
  if (loading) return <p style={{ color: '#64748b' }}>Loading...</p>
  if (!remittances?.length) return <p style={{ color: '#64748b' }}>No remittances yet.</p>
  const total = remittances.reduce((s, r) => s + Number(r.reported_amount || 0), 0)
  return (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>{remittances.length} remittances · total {fmt(total)}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #334155' }}>
            {['Sender','Amount','State','Method','Batch','Date','Source'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {remittances.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#ffffff05' }}>
              <td style={{ padding: '9px 12px', color: '#f8fafc', fontWeight: 600 }}>{r.sender_name || '—'}</td>
              <td style={{ padding: '9px 12px', color: '#6366f1', fontWeight: 700 }}>{fmt(r.reported_amount)}</td>
              <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{r.state || '—'}</td>
              <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{r.payment_method || '—'}</td>
              <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{r.batch_ref || '—'}</td>
              <td style={{ padding: '9px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
              <td style={{ padding: '9px 12px' }}>{r.source_message ? <SourceMsg msg={r.source_message} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function App() {
  const [page, setPage]               = useState('dashboard')
  const [summary, setSummary]         = useState(null)
  const [orders, setOrders]           = useState([])
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    Promise.all([fetchSummary(), fetchOrders(), fetchRemittances()])
      .then(([s, o, r]) => { setSummary(s); setOrders(o); setRemittances(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const nav = [
    { id: 'dashboard',   label: '📊 Dashboard' },
    { id: 'orders',      label: '📦 Orders' },
    { id: 'remittances', label: '💰 Remittances' },
  ]

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: 2 }}>ADABA GLOBAL VENTURES</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>Operating Intelligence System</h1>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
          <div>Prototype v1</div>
          <div style={{ color: '#10b981' }}>● Live</div>
        </div>
      </div>

      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '0 24px', display: 'flex' }}>
        {nav.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              color: page === n.id ? '#10b981' : '#64748b',
              borderBottom: page === n.id ? '2px solid #10b981' : '2px solid transparent' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 24px' }}>
        {page === 'dashboard'   && <DashboardPage   summary={summary}         loading={loading} />}
        {page === 'orders'      && <OrdersPage      orders={orders}           loading={loading} />}
        {page === 'remittances' && <RemittancesPage remittances={remittances} loading={loading} />}
      </div>
    </div>
  )
}
