import { useState, useEffect } from 'react'
import { fetchUnknownMessages, fetchTrainingRules, teachAI } from '../api.js'

const INTENT_OPTIONS = ['order', 'delivery', 'remittance', 'issue']

export default function LearningInbox() {
  const [unknown, setUnknown]   = useState([])
  const [rules, setRules]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('inbox')
  const [teaching, setTeaching] = useState(null)
  const [form, setForm]         = useState({ pattern: '', meaning: '', intent: 'delivery', field: '', value: '' })
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    Promise.all([fetchUnknownMessages(), fetchTrainingRules()])
      .then(([u, r]) => { setUnknown(u); setRules(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function startTeaching(msg) {
    setTeaching(msg)
    setForm({
      pattern:    msg.body.slice(0, 50),
      meaning:    '',
      intent:     'delivery',
      field:      'event_type',
      value:      'delivered',
      exampleInput: msg.body
    })
    setSaved(false)
  }

  async function handleTeach() {
    if (!form.pattern || !form.meaning) return
    await teachAI({
      pattern:        form.pattern,
      meaning:        form.meaning,
      intent:         form.intent,
      field:          form.field,
      value:          form.value,
      exampleInput:   form.exampleInput,
      unknownMessageId: teaching?.id
    })
    setSaved(true)
    setUnknown(prev => prev.filter(m => m.id !== teaching.id))
    const updated = await fetchTrainingRules()
    setRules(updated)
    setTimeout(() => { setTeaching(null); setSaved(false) }, 1500)
  }

  const fmtDate = (d) => new Date(d).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
          🧠 Learning Inbox
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Teach the AI new patterns. Every correction makes it smarter permanently.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Needs Teaching', value: unknown.length, color: '#f59e0b' },
          { label: 'Rules Learned',  value: rules.length,   color: '#10b981' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#1e293b', border: `1px solid ${s.color}44`, borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: '14px 18px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#f8fafc' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: 16 }}>
        {[
          { id: 'inbox', label: `📬 Teach Me Queue (${unknown.length})` },
          { id: 'rules', label: `📚 Learned Rules (${rules.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? '#10b981' : '#64748b',
              borderBottom: tab === t.id ? '2px solid #10b981' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading...</p>}

      {/* TEACH ME QUEUE */}
      {!loading && tab === 'inbox' && (
        <div>
          {unknown.length === 0 && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 32, margin: '0 0 8px' }}>✅</p>
              <p style={{ margin: 0, color: '#10b981', fontWeight: 700 }}>All clear — no unknown messages</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>The AI understood everything it received</p>
            </div>
          )}
          {unknown.map(msg => (
            <div key={msg.id} style={{ background: '#1e293b', border: '1px solid #f59e0b44', borderLeft: '4px solid #f59e0b', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1 }}>Unknown Message</span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#f8fafc', fontWeight: 600 }}>
                    From: {msg.sender_name || 'Unknown'} · {msg.group_name || 'Unknown Group'}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(msg.created_at)}</span>
              </div>
              <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#fcd34d', fontFamily: 'monospace' }}>"{msg.body}"</p>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>
                Reason: {msg.reason}
              </p>
              {teaching?.id === msg.id ? (
                <div style={{ background: '#0f172a', border: '1px solid #10b981', borderRadius: 8, padding: 16 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#10b981' }}>Teach the AI what this means:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Pattern / Word</label>
                      <input value={form.pattern} onChange={e => setForm({...form, pattern: e.target.value})}
                        placeholder='e.g. gbam'
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Intent</label>
                      <select value={form.intent} onChange={e => setForm({...form, intent: e.target.value})}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', fontSize: 13 }}>
                        {INTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>What does it mean?</label>
                    <input value={form.meaning} onChange={e => setForm({...form, meaning: e.target.value})}
                      placeholder='e.g. order was successfully delivered to customer'
                      style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleTeach}
                      style={{ padding: '9px 20px', background: '#10b981', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {saved ? '✅ Saved!' : '💾 Teach AI'}
                    </button>
                    <button onClick={() => setTeaching(null)}
                      style={{ padding: '9px 16px', background: '#334155', border: 'none', borderRadius: 6, color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startTeaching(msg)}
                  style={{ padding: '8px 18px', background: '#f59e0b22', border: '1px solid #f59e0b', borderRadius: 6, color: '#f59e0b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🎓 Teach AI what this means
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* LEARNED RULES */}
      {!loading && tab === 'rules' && (
        <div>
          {rules.length === 0 && (
            <p style={{ color: '#64748b', fontSize: 13 }}>No rules learned yet. Teach the AI from the queue above.</p>
          )}
          {rules.map((rule, i) => (
            <div key={rule.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 14, marginBottom: 8, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 13, color: '#fcd34d', background: '#0f172a', padding: '2px 8px', borderRadius: 4 }}>{rule.pattern}</code>
                  <span style={{ fontSize: 12, color: '#64748b' }}>→</span>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{rule.meaning}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {rule.intent && <span style={{ fontSize: 10, padding: '1px 7px', background: '#10b98122', color: '#10b981', borderRadius: 3, fontWeight: 700 }}>{rule.intent}</span>}
                  {rule.field  && <span style={{ fontSize: 10, padding: '1px 7px', background: '#6366f122', color: '#6366f1', borderRadius: 3, fontWeight: 700 }}>{rule.field}: {rule.value}</span>}
                  <span style={{ fontSize: 10, padding: '1px 7px', background: '#334155', color: '#64748b', borderRadius: 3 }}>{rule.rule_type}</span>
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(rule.created_at)}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
