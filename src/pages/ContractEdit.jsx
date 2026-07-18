import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { navigate } from '../App.jsx'

export default function ContractEdit({ customerId, contractId, showFlash }) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState([])
  const [form, setForm] = useState({
    plan_name: '', price: 0, discount: 0, discount_type: 'amount',
    monthly_fee: 0, start_date: '', end_date: '', note: '',
  })

  useEffect(() => {
    (async () => {
      const { data: cust } = await supabase.from('crm_customers').select('*').eq('id', customerId).single()
      setCustomer(cust)
      if (contractId) {
        const { data: c } = await supabase.from('crm_contracts').select('*').eq('id', contractId).single()
        if (c) {
          setForm({
            plan_name: c.plan_name || '', price: c.price || 0, discount: c.discount || 0,
            discount_type: c.discount_type || 'amount', monthly_fee: c.monthly_fee || 0,
            start_date: c.start_date || '', end_date: c.end_date || '', note: c.note || '',
          })
        }
      }
      setLoading(false)
    })()
  }, [customerId, contractId])

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const onSave = async (e) => {
    e.preventDefault()
    setErrors([])
    if (!form.plan_name.trim() && !Number(form.price) && !Number(form.monthly_fee)) {
      setErrors(['プラン名か価格、月額のいずれかは入力してください。'])
      return
    }
    const payload = {
      customer_id: customerId,
      plan_name: form.plan_name.trim(),
      price: Number(form.price) || 0,
      discount: Number(form.discount) || 0,
      discount_type: form.discount_type === 'percent' ? 'percent' : 'amount',
      monthly_fee: Number(form.monthly_fee) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      note: form.note.trim(),
    }
    let error
    if (contractId) {
      ;({ error } = await supabase.from('crm_contracts').update(payload).eq('id', contractId))
    } else {
      ;({ error } = await supabase.from('crm_contracts').insert(payload))
    }
    if (error) { setErrors([error.message]); return }
    showFlash(contractId ? '契約を更新しました。' : '契約を追加しました。')
    navigate(`/customer/view?id=${customerId}`)
  }

  const onDelete = async () => {
    if (!window.confirm('この契約を削除しますか?')) return
    await supabase.from('crm_contracts').delete().eq('id', contractId)
    showFlash('契約を削除しました。')
    navigate(`/customer/view?id=${customerId}`)
  }

  if (loading || !customer) return <p className="muted">読み込み中…</p>

  return (
    <>
      <h1>{contractId ? '契約編集' : '契約追加'}</h1>
      <p className="sub">顧客: <a onClick={() => navigate(`/customer/view?id=${customerId}`)}>{customer.name}</a></p>

      {errors.length > 0 && <div className="err">{errors.join('\n')}</div>}

      <form className="panel" onSubmit={onSave}>
        <div className="field">
          <label>契約プラン名</label>
          <input type="text" value={form.plan_name} onChange={(e) => setField('plan_name', e.target.value)} placeholder="例: 電磁波変調 スタンダード" />
        </div>

        <div className="grid3">
          <div className="field">
            <label>基本価格（円）</label>
            <input type="number" value={form.price} onChange={(e) => setField('price', e.target.value)} />
          </div>
          <div className="field">
            <label>割引</label>
            <input type="number" value={form.discount} onChange={(e) => setField('discount', e.target.value)} />
          </div>
          <div className="field">
            <label>割引種別</label>
            <select value={form.discount_type} onChange={(e) => setField('discount_type', e.target.value)}>
              <option value="amount">円引き</option>
              <option value="percent">％引き</option>
            </select>
          </div>
        </div>

        <div className="grid3">
          <div className="field">
            <label>月額（定期入金の基準・円）</label>
            <input type="number" value={form.monthly_fee} onChange={(e) => setField('monthly_fee', e.target.value)} />
          </div>
          <div className="field">
            <label>契約開始日</label>
            <input type="date" value={form.start_date} onChange={(e) => setField('start_date', e.target.value)} />
          </div>
          <div className="field">
            <label>契約終了日（任意）</label>
            <input type="date" value={form.end_date} onChange={(e) => setField('end_date', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>備考</label>
          <textarea rows={3} value={form.note} onChange={(e) => setField('note', e.target.value)} />
        </div>

        <div className="actions">
          <button className="btn primary" type="submit">{contractId ? '更新する' : '追加する'}</button>
          <a className="btn ghost" onClick={() => navigate(`/customer/view?id=${customerId}`)}>キャンセル</a>
        </div>
      </form>

      {contractId && (
        <button className="btn danger" onClick={onDelete}>この契約を削除</button>
      )}
    </>
  )
}
