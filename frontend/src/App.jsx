import { useState, useEffect, useCallback } from 'react'
import { api } from './api.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = n  => '₦' + Number(n || 0).toLocaleString('en-NG')
const fmtDate = d  => new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
const today   = () => new Date().toISOString().split('T')[0]
const daysAgo = n  => new Date(Date.now() - n*24*60*60*1000).toISOString().split('T')[0]

const STATUS_COLOR = {
  DELIVERED:  { bg: '#10b98120', text: '#10b981' },
  PENDING:    { bg: '#f59e0b20', text: '#f59e0b' },
  DISPATCHED: { bg: '#6366f120', text: '#6366f1' },
  FAILED:     { bg: '#ef444420', text: '#ef4444' },
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Spinner() {
  return <p style={{ color: '#64748b', padding: '20px 0' }}>Loading...</p>
}

function KpiCard({ label, value, sub, color = '#10b981' }) {
  return (
    <div style={{ background: '#1e293b', border: `1px solid ${color}44`,
      borderTop: `3px solid ${color}`, borderRadius: 10, padding: '16px 20px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#64748b',
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
      <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{sub}</p>}
    </div>
  )
}

function DateRangePicker({ from, to, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>From</span>
      <input type="date" value={from} onChange={e => onChange(e.target.value, to)}
        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
          color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }} />
      <span style={{ fontSize: 12, color: '#64748b' }}>To</span>
      <input type="date" value={to} onChange={e => onChange(from, e.target.value)}
        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
          color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }} />
      {[
        { label: 'Today',   from: today(),     to: today() },
        { label: '7 days',  from: daysAgo(7),  to: today() },
        { label: '30 days', from: daysAgo(30), to: today() },
      ].map(p => (
        <button key={p.label} onClick={() => onChange(p.from, p.to)}
          style={{ fontSize: 11, padding: '5px 10px', background: '#334155',
            border: 'none', borderRadius: 5, color: '#e2e8f0', cursor: 'pointer' }}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function SourceMsg({ msg }) {
  const [show, setShow] = useState(false)
  return (
    <span>
      <button onClick={() => setShow(!show)}
        style={{ fontSize: 10, padding: '2px 6px', background: '#334155',
          border: 'none', borderRadius: 3, color: '#94a3b8', cursor: 'pointer' }}>
        {show ? 'hide' : 'source'}
      </button>
      {show && <div style={{ marginTop: 4, fontSize: 11, color: '#fcd34d',
        background: '#0f172a', padding: '4px 8px', borderRadius: 4,
        fontStyle: 'italic' }}>"{msg}"</div>}
    </span>
  )
}
// ── Page: Daily Summary ───────────────────────────────────────────────────────
function DailyPage() {
  const [data, setData]   = useState(null)
  const [date, setDate]   = useState(today())
  const [trend, setTrend] = useState([])

  useEffect(() => {
    api.dailySummary(date).then(setData).catch(console.error)
    api.revenueTrend(14).then(setTrend).catch(console.error)
  }, [date])

  if (!data) return <Spinner />
  const o = data.orders
  const rate = Number(data.delivery_rate) || 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Date:</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
            color: '#e2e8f0', padding: '6px 10px', fontSize: 12 }} />
        {['Today', 'Yesterday'].map((label, i) => (
          <button key={label} onClick={() => setDate(daysAgo(i))}
            style={{ fontSize: 11, padding: '5px 10px', background: '#334155',
              border: 'none', borderRadius: 5, color: '#e2e8f0', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Total Orders"  value={o.total_orders}    color="#f59e0b"  sub={`${o.total_pending} pending`} />
        <KpiCard label="Delivered"     value={o.total_delivered} color="#10b981"  sub={`${rate}% delivery rate`} />
        <KpiCard label="Failed"        value={o.total_failed}    color="#ef4444"  sub={`Lost: ${fmt(o.failed_revenue)}`} />
        <KpiCard label="Revenue"       value={fmt(o.total_revenue)} color="#6366f1" sub="from placed orders" />
        <KpiCard label="Remittance"    value={fmt(data.remittances.total_remitted)} color="#0ea5e9" sub="reported via WhatsApp" />
        <KpiCard label="Open Issues"   value={data.issues.total_issues} color="#f97316" sub="complaints & problems" />
      </div>
      {trend.length > 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 16 }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700,
            color: '#64748b', textTransform: 'uppercase' }}>14-Day Revenue Trend</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {trend.map((d, i) => {
              const maxRev = Math.max(...trend.map(t => Number(t.total_revenue) || 0), 1)
              const h = Math.max((Number(d.total_revenue) / maxRev) * 70, 4)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4 }}>
                  <div title={`${d.date}: ${fmt(d.total_revenue)}`}
                    style={{ width: '100%', height: h, background: '#6366f1',
                      borderRadius: 3, minHeight: 4 }} />
                  <span style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(d.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
// ── Page: CSR Performance ─────────────────────────────────────────────────────
function CSRPage() {
  const [data, setData] = useState([])
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo]     = useState(today())

  useEffect(() => {
    api.csrPerformance(from, to).then(setData).catch(console.error)
  }, [from, to])

  return (
    <div>
      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      {data.length === 0 ? <p style={{ color: '#64748b' }}>No CSR data for this period.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Rank','CSR Name','Orders','Delivered','Failed','Delivery Rate','Revenue'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                    fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e293b',
                  background: i === 0 ? '#f59e0b08' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', color: i === 0 ? '#f59e0b' : '#64748b', fontWeight: 700 }}>#{i + 1}</td>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>
                    {c.csr_name}
                    {i === 0 && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b' }}>⭐ TOP</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{c.total_orders}</td>
                  <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 600 }}>{c.delivered}</td>
                  <td style={{ padding: '10px 12px', color: '#ef4444' }}>{c.failed}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: '#334155', borderRadius: 3 }}>
                        <div style={{ width: `${c.delivery_rate || 0}%`, height: '100%',
                          background: Number(c.delivery_rate) >= 70 ? '#10b981' : '#ef4444',
                          borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#e2e8f0' }}>{c.delivery_rate || 0}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6366f1', fontWeight: 600 }}>{fmt(c.delivered_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page: Products ────────────────────────────────────────────────────────────
function ProductPage() {
  const [data, setData] = useState([])
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo]     = useState(today())

  useEffect(() => {
    api.productPerformance(from, to).then(setData).catch(console.error)
  }, [from, to])

  return (
    <div>
      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      {data.length === 0 ? <p style={{ color: '#64748b' }}>No product data for this period.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {data.map((p, i) => (
            <div key={i} style={{ background: '#1e293b', border: '1px solid #334155',
              borderTop: `3px solid ${i === 0 ? '#f59e0b' : '#334155'}`, borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{p.product || 'Unknown'}</span>
                {i === 0 && <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b20',
                  padding: '2px 6px', borderRadius: 3 }}>BEST SELLER</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Orders',    value: p.total_orders },
                  { label: 'Delivered', value: p.delivered,   color: '#10b981' },
                  { label: 'Failed',    value: p.failed,      color: '#ef4444' },
                  { label: 'Del. Rate', value: `${p.delivery_rate || 0}%` },
                ].map(stat => (
                  <div key={stat.label} style={{ background: '#0f172a', borderRadius: 6, padding: '8px 10px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: '#64748b',
                      fontWeight: 700, textTransform: 'uppercase' }}>{stat.label}</p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700,
                      color: stat.color || '#f8fafc' }}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: '#6366f1' }}>
                {fmt(p.total_revenue)} revenue
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ── Page: Groups ──────────────────────────────────────────────────────────────
function GroupPage() {
  const [data, setData] = useState([])
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo]     = useState(today())

  useEffect(() => {
    api.groupPerformance(from, to).then(setData).catch(console.error)
  }, [from, to])

  return (
    <div>
      <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
      {data.length === 0 ? <p style={{ color: '#64748b' }}>No group data for this period.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Group','Orders','Delivered','Failed','Delivery Rate','Revenue'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                    fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((g, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>{g.group_name || 'Unknown Group'}</td>
                  <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{g.total_orders}</td>
                  <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 600 }}>{g.delivered}</td>
                  <td style={{ padding: '10px 12px', color: '#ef4444' }}>{g.failed}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 6, background: '#334155', borderRadius: 3 }}>
                        <div style={{ width: `${g.delivery_rate || 0}%`, height: '100%',
                          background: Number(g.delivery_rate) >= 70 ? '#10b981' : '#ef4444',
                          borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#e2e8f0' }}>{g.delivery_rate || 0}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6366f1', fontWeight: 600 }}>{fmt(g.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page: Orders ──────────────────────────────────────────────────────────────
function OrdersPage() {
  const [orders, setOrders]   = useState([])
  const [total, setTotal]     = useState(0)
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(true)
  const LIMIT = 20
  const [filters, setFilters] = useState({
    from: daysAgo(7), to: today(),
    csr: '', product: '', status: '', state: '', group: ''
  })

  const load = useCallback((newOffset = 0) => {
    setLoading(true)
    api.orders({ ...filters, limit: LIMIT, offset: newOffset })
      .then(r => { setOrders(r.orders); setTotal(r.total); setOffset(newOffset) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load(0) }, [load])

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  const inputStyle = {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', padding: '6px 10px', fontSize: 12, width: '100%'
  }

  return (
    <div>
      <div style={{ background: '#1e293b', border: '1px solid #334155',
        borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700,
          color: '#64748b', textTransform: 'uppercase' }}>Filters</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b' }}>From</p>
            <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b' }}>To</p>
            <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} style={inputStyle} />
          </div>
          {[
            { key: 'csr',     label: 'CSR Name', placeholder: 'e.g. Bola' },
            { key: 'product', label: 'Product',  placeholder: 'e.g. SAAM Cream' },
            { key: 'state',   label: 'State',    placeholder: 'e.g. Lagos' },
            { key: 'group',   label: 'Group',    placeholder: 'e.g. Atomic Benin' },
          ].map(f => (
            <div key={f.key}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b' }}>{f.label}</p>
              <input placeholder={f.placeholder} value={filters[f.key]}
                onChange={e => setFilter(f.key, e.target.value)} style={inputStyle} />
            </div>
          ))}
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b' }}>Status</p>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={inputStyle}>
              <option value="">All</option>
              {['PENDING','DELIVERED','FAILED','DISPATCHED','RETURNED'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => load(0)}
            style={{ padding: '7px 16px', background: '#10b981', border: 'none',
              borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Apply Filters
          </button>
          <button onClick={() => setFilters({ from: daysAgo(7), to: today(), csr:'', product:'', status:'', state:'', group:'' })}
            style={{ padding: '7px 16px', background: '#334155', border: 'none',
              borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer' }}>
            Reset
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>
        Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total} orders
      </p>

      {loading ? <Spinner /> : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  {['Customer','Phone','Product','Qty','Price','State','CSR','Group','Status','Date','Source'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10,
                      color: '#64748b', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0
                  ? <tr><td colSpan={11} style={{ padding: 20, color: '#64748b', textAlign: 'center' }}>No orders found.</td></tr>
                  : orders.map((o, i) => {
                    const c = STATUS_COLOR[o.order_status] || { bg:'#33415520', text:'#94a3b8' }
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #1e293b',
                        background: i % 2 === 0 ? 'transparent' : '#ffffff05' }}>
                        <td style={{ padding: '8px 10px', color: '#f8fafc', fontWeight: 600, whiteSpace: 'nowrap' }}>{o.customer_name || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{o.customer_phone || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{o.product || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{o.quantity || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {o.selling_price ? fmt(o.selling_price) : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{o.state || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{o.csr_name || '—'}</td>
                        <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{o.group_name || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
                            background: c.bg, color: c.text, fontWeight: 700, whiteSpace: 'nowrap' }}>{o.order_status}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(o.created_at)}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {o.source_message ? <SourceMsg msg={o.source_message} /> : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          {total > LIMIT && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={() => load(offset - LIMIT)} disabled={offset === 0}
                style={{ padding: '6px 14px', background: offset === 0 ? '#1e293b' : '#334155',
                  border: 'none', borderRadius: 6, color: '#e2e8f0',
                  fontSize: 12, cursor: offset === 0 ? 'default' : 'pointer' }}>← Prev</button>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Page {Math.floor(offset/LIMIT)+1} of {Math.ceil(total/LIMIT)}
              </span>
              <button onClick={() => load(offset + LIMIT)} disabled={offset + LIMIT >= total}
                style={{ padding: '6px 14px', background: offset + LIMIT >= total ? '#1e293b' : '#334155',
                  border: 'none', borderRadius: 6, color: '#e2e8f0',
                  fontSize: 12, cursor: offset + LIMIT >= total ? 'default' : 'pointer' }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// ── Page: Learning Inbox ──────────────────────────────────────────────────────
function LearningPage() {
  const [unknown, setUnknown]   = useState([])
  const [rules, setRules]       = useState([])
  const [tab, setTab]           = useState('queue')
  const [teaching, setTeaching] = useState(null)
  const [form, setForm]         = useState({ pattern:'', meaning:'', intent:'delivery' })

  useEffect(() => {
    api.unknownMessages().then(setUnknown).catch(console.error)
    api.trainingRules().then(setRules).catch(console.error)
  }, [])

  const teach = async () => {
    if (!form.pattern || !form.meaning) return
    await api.teachRule({ ...form, unknownMessageId: teaching?.id })
    setUnknown(u => u.filter(m => m.id !== teaching?.id))
    setRules(r => [...r, { ...form, id: Date.now(), created_at: new Date().toISOString() }])
    setTeaching(null)
    setForm({ pattern: '', meaning: '', intent: 'delivery' })
  }

  const inputStyle = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box'
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'queue', label: `🔔 Teach Me Queue (${unknown.length})` },
          { id: 'rules', label: `📚 Learned Rules (${rules.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600,
              background: tab === t.id ? '#10b981' : '#334155',
              border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'queue' && (
        <div>
          {unknown.length === 0
            ? <p style={{ color: '#10b981' }}>✅ No unknown messages — AI understood everything.</p>
            : unknown.map(m => (
              <div key={m.id} style={{ background: '#1e293b', border: '1px solid #334155',
                borderRadius: 10, padding: 16, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{m.sender_name}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>·</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{m.group_name}</span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#fcd34d',
                  fontFamily: 'monospace', background: '#0f172a', padding: '8px 12px',
                  borderRadius: 6 }}>"{m.body}"</p>
                {teaching?.id === m.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input placeholder="Pattern (e.g. gbam, customer collected, done)"
                      value={form.pattern} onChange={e => setForm(f => ({...f, pattern: e.target.value}))}
                      style={inputStyle} />
                    <input placeholder="What it means (e.g. order was delivered to customer)"
                      value={form.meaning} onChange={e => setForm(f => ({...f, meaning: e.target.value}))}
                      style={inputStyle} />
                    <select value={form.intent} onChange={e => setForm(f => ({...f, intent: e.target.value}))}
                      style={inputStyle}>
                      {['order','delivery','remittance','issue','noise'].map(i => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={teach}
                        style={{ padding: '7px 16px', background: '#10b981', border: 'none',
                          borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>💾 Save Rule</button>
                      <button onClick={() => setTeaching(null)}
                        style={{ padding: '7px 16px', background: '#334155', border: 'none',
                          borderRadius: 6, color: '#e2e8f0', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setTeaching(m); setForm({ pattern:'', meaning:'', intent:'delivery' }) }}
                    style={{ padding: '6px 14px', background: '#6366f1', border: 'none',
                      borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                    🎓 Teach AI
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
      {tab === 'rules' && (
        <div>
          {rules.length === 0
            ? <p style={{ color: '#64748b' }}>No rules yet. Teach the AI from the queue above.</p>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155' }}>
                    {['Pattern','Meaning','Intent','Field','Added'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left',
                        fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '8px 10px', color: '#fcd34d', fontFamily: 'monospace' }}>{r.pattern}</td>
                      <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{r.meaning}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', background: '#6366f120',
                          color: '#6366f1', borderRadius: 3, fontWeight: 700 }}>{r.intent}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{r.field || '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b', fontSize: 11 }}>{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}
    </div>
  )
}

// ── App Shell ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'daily',    label: '📊 Daily Summary' },
  { id: 'orders',   label: '📦 Orders' },
  { id: 'csr',      label: '👤 CSR Performance' },
  { id: 'products', label: '🛍️ Products' },
  { id: 'groups',   label: '💬 Groups' },
  { id: 'learning', label: '🧠 Learning' },
]

const PAGE_TITLES = {
  daily:    'Daily Operations Summary',
  orders:   'Orders',
  csr:      'CSR Performance',
  products: 'Product Intelligence',
  groups:   'Group Intelligence',
  learning: 'AI Learning Inbox',
}

export default function App() {
  const [page, setPage] = useState('daily')

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: '#0f172a',
      minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '12px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: 2 }}>ADABA GLOBAL VENTURES</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>Operating Intelligence System</h1>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
          <div style={{ color: '#10b981', fontWeight: 700 }}>● Live</div>
          <div>Prototype v1</div>
        </div>
      </div>
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '0 24px', overflowX: 'auto', display: 'flex' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              color: page === n.id ? '#10b981' : '#64748b',
              borderBottom: page === n.id ? '2px solid #10b981' : '2px solid transparent' }}>
            {n.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{PAGE_TITLES[page]}</h2>
        {page === 'daily'    && <DailyPage />}
        {page === 'orders'   && <OrdersPage />}
        {page === 'csr'      && <CSRPage />}
        {page === 'products' && <ProductPage />}
        {page === 'groups'   && <GroupPage />}
        {page === 'learning' && <LearningPage />}
      </div>
    </div>
  )
}
