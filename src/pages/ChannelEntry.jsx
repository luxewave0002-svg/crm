import React, { useState } from 'react'
import { supabase, CHANNELS, LUXE_WAVE_PLANS, TEST_PERIODS, calcTestEndDate, onlineNeedsTestPeriod, retailNeedsTestPeriod } from '../supabaseClient'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForms = () => ({
  online: { service_name: CHANNELS.online.options[0], plan: '', test_period: TEST_PERIODS[0].value, purchase_date: today(), note: '' },
  retail: { product_name: CHANNELS.retail.options[0], quantity: 1, test_period: TEST_PERIODS[0].value, purchase_date: today(), note: '' },
  offline: { visit_type: CHANNELS.offline.options[0], visit_date: today(), notes: '' },
})

export default function ChannelEntry({ customerId, onSaved, showFlash }) {
  const [tab, setTab] = useState('online')
  const [forms, setForms] = useState(emptyForms())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (ch, k, v) =>
    setForms((f) => ({ ...f, [ch]: { ...f[ch], [k]: v } }))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const f = forms[tab]
    let payload
    if (tab === 'online') {
      const testing = onlineNeedsTestPeriod(f.service_name, f.plan)
      payload = {
        customer_id: customerId,
        service_name: f.service_name,
        plan: f.plan.trim() || null,
        purchase_date: f.purchase_date || today(),
        note: f.note.trim() || null,
        test_period: testing ? f.test_period : null,
        test_end_date: testing ? calcTestEndDate(f.purchase_date || today(), f.test_period) : null,
      }
    } else if (tab === 'retail') {
      const testing = retailNeedsTestPeriod(f.product_name)
      payload = {
        customer_id: customerId,
        product_name: f.product_name,
        quantity: Math.max(1, Number(f.quantity) || 1),
        purchase_date: f.purchase_date || today(),
        note: f.note.trim() || null,
        test_period: testing ? f.test_period : null,
        test_end_date: testing ? calcTestEndDate(f.purchase_date || today(), f.test_period) : null,
      }
    } else {
      payload = {
        customer_id: customerId,
        visit_type: f.visit_type,
        visit_date: f.visit_date || today(),
        notes: f.notes.trim() || null,
      }
    }

    const { error: err } = await supabase.from(CHANNELS[tab].table).insert(payload)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setForms((prev) => ({ ...prev, [tab]: emptyForms()[tab] }))
    showFlash(`${CHANNELS[tab].label}の履歴を追加しました。`)
    onSaved()
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, border: 'none' }}>サービス履歴を追加</h2>
      <p className="small muted">チャネルを選んで入力してください。登録した履歴は下の一元カルテに時系列で表示されます。</p>

      <div className="tabs">
        {Object.values(CHANNELS).map((c, i) => (
          <button
            key={c.key}
            type="button"
            className={`tab on-${c.key} ${tab === c.key ? 'active' : ''}`}
            onClick={() => { setTab(c.key); setError('') }}
          >
            {i + 1}. {c.label}
          </button>
        ))}
      </div>

      {error && <div className="err">{error}</div>}

      <form onSubmit={onSubmit}>
        {tab === 'online' && (
          <>
            <div className="grid2">
              <div className="field">
                <label>サービス名</label>
                <select
                  value={forms.online.service_name}
                  onChange={(e) => setField('online', 'service_name', e.target.value)}
                >
                  {CHANNELS.online.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>プラン</label>
                {forms.online.service_name === 'LUXE WAVE' ? (
                  <select
                    value={forms.online.plan}
                    onChange={(e) => setField('online', 'plan', e.target.value)}
                  >
                    <option value="">未選択</option>
                    {LUXE_WAVE_PLANS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={forms.online.plan}
                    onChange={(e) => setField('online', 'plan', e.target.value)}
                    placeholder="例: 3ヶ月プラン"
                  />
                )}
              </div>
            </div>

            {onlineNeedsTestPeriod(forms.online.service_name, forms.online.plan) && (
              <div className="grid2">
                <div className="field">
                  <label>テスト期間</label>
                  <select
                    value={forms.online.test_period}
                    onChange={(e) => setField('online', 'test_period', e.target.value)}
                  >
                    {TEST_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>テスト終了予定日</label>
                  <input type="text" value={calcTestEndDate(forms.online.purchase_date, forms.online.test_period) || '—'} disabled />
                </div>
              </div>
            )}

            <div className="grid2">
              <div className="field">
                <label>購入日</label>
                <input
                  type="date"
                  value={forms.online.purchase_date}
                  onChange={(e) => setField('online', 'purchase_date', e.target.value)}
                />
              </div>
              <div className="field">
                <label>備考</label>
                <input
                  type="text"
                  value={forms.online.note}
                  onChange={(e) => setField('online', 'note', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {tab === 'retail' && (
          <>
            <div className="grid3">
              <div className="field">
                <label>商品名</label>
                <select
                  value={forms.retail.product_name}
                  onChange={(e) => setField('retail', 'product_name', e.target.value)}
                >
                  {CHANNELS.retail.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>数量</label>
                <input
                  type="number"
                  min="1"
                  value={forms.retail.quantity}
                  onChange={(e) => setField('retail', 'quantity', e.target.value)}
                />
              </div>
              <div className="field">
                <label>購入日</label>
                <input
                  type="date"
                  value={forms.retail.purchase_date}
                  onChange={(e) => setField('retail', 'purchase_date', e.target.value)}
                />
              </div>
            </div>

            {retailNeedsTestPeriod(forms.retail.product_name) && (
              <div className="grid2">
                <div className="field">
                  <label>テスト期間</label>
                  <select
                    value={forms.retail.test_period}
                    onChange={(e) => setField('retail', 'test_period', e.target.value)}
                  >
                    {TEST_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>テスト終了予定日</label>
                  <input type="text" value={calcTestEndDate(forms.retail.purchase_date, forms.retail.test_period) || '—'} disabled />
                </div>
              </div>
            )}

            <div className="field">
              <label>備考</label>
              <input
                type="text"
                value={forms.retail.note}
                onChange={(e) => setField('retail', 'note', e.target.value)}
              />
            </div>
          </>
        )}

        {tab === 'offline' && (
          <>
            <div className="grid2">
              <div className="field">
                <label>サービス名</label>
                <select
                  value={forms.offline.visit_type}
                  onChange={(e) => setField('offline', 'visit_type', e.target.value)}
                >
                  {CHANNELS.offline.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>来店日</label>
                <input
                  type="date"
                  value={forms.offline.visit_date}
                  onChange={(e) => setField('offline', 'visit_date', e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>スタッフメモ</label>
              <textarea
                rows={3}
                value={forms.offline.notes}
                onChange={(e) => setField('offline', 'notes', e.target.value)}
                placeholder="例: 3回目施術、肌良好"
              />
            </div>
          </>
        )}

        <div className="actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? '追加中…' : '履歴を追加'}
          </button>
        </div>
      </form>
    </div>
  )
}
