import React, { useEffect, useState } from 'react'
import { supabase, MAX_LOCATIONS, MAX_PHOTOS, PHOTO_BUCKET, CHANNELS, LUXE_WAVE_PLANS, TEST_PERIODS, calcTestEndDate, onlineNeedsTestPeriod, retailNeedsTestPeriod, NECKLACE_LEVELS, retailNeedsLevel, offlineNeedsPrice, CUSTOMER_STATUSES } from '../supabaseClient'
import { navigate } from '../App.jsx'

const emptyLoc = () => ({ label: '', address: '', note: '' })
const today = () => new Date().toISOString().slice(0, 10)

const emptyRow = (ch) => {
  if (ch === 'online') return { service_name: CHANNELS.online.options[0], plan: '', test_period: TEST_PERIODS[0].value, purchase_date: today(), note: '' }
  if (ch === 'retail') return { product_name: CHANNELS.retail.options[0], quantity: 1, level: NECKLACE_LEVELS[0], test_period: TEST_PERIODS[0].value, purchase_date: today(), note: '' }
  return { visit_type: CHANNELS.offline.options[0], price: '', visit_date: today(), notes: '' }
}

export default function CustomerEdit({ id, showFlash }) {
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState([])
  const [form, setForm] = useState({
    name: '', kana: '', phone: '', email: '', postal_code: '', address: '',
    start_datetime: '', memo: '', status: 'active',
  })
  const [locs, setLocs] = useState(Array.from({ length: MAX_LOCATIONS }, emptyLoc))
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)
  const [zipError, setZipError] = useState('')
  const [chanEnable, setChanEnable] = useState({ online: false, retail: false, offline: false })
  const [chanRows, setChanRows] = useState({
    online: [emptyRow('online')],
    retail: [emptyRow('retail')],
    offline: [emptyRow('offline')],
  })

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: cust } = await supabase.from('crm_customers').select('*').eq('id', id).single()
      if (cust) {
        setForm({
          name: cust.name || '',
          kana: cust.kana || '',
          phone: cust.phone || '',
          email: cust.email || '',
          postal_code: cust.postal_code || '',
          address: cust.address || '',
          start_datetime: cust.start_datetime ? cust.start_datetime.slice(0, 16) : '',
          memo: cust.memo || '',
          status: cust.status || 'active',
        })
      }
      const { data: locRows } = await supabase
        .from('crm_locations').select('*').eq('customer_id', id).order('sort_order')
      const filled = Array.from({ length: MAX_LOCATIONS }, (_, i) => {
        const r = (locRows || [])[i]
        return r ? { label: r.label || '', address: r.address || '', note: r.note || '' } : emptyLoc()
      })
      setLocs(filled)

      await loadPhotos()
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadPhotos = async () => {
    if (!id) return
    const { data } = await supabase.from('crm_photos').select('*').eq('customer_id', id).order('id')
    const withUrls = await Promise.all(
      (data || []).map(async (p) => {
        const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(p.path, 3600)
        return { ...p, url: signed?.signedUrl }
      })
    )
    setPhotos(withUrls)
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setLoc = (i, k, v) =>
    setLocs((arr) => arr.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)))

  const toggleChan = (ch, checked) => setChanEnable((s) => ({ ...s, [ch]: checked }))
  const addChanRow = (ch) => setChanRows((r) => ({ ...r, [ch]: [...r[ch], emptyRow(ch)] }))
  const removeChanRow = (ch, idx) =>
    setChanRows((r) => ({ ...r, [ch]: r[ch].filter((_, i) => i !== idx) }))
  const setChanRowField = (ch, idx, k, v) =>
    setChanRows((r) => ({
      ...r,
      [ch]: r[ch].map((row, i) => (i === idx ? { ...row, [k]: v } : row)),
    }))

  const lookupZip = async (raw) => {
    const digits = (raw || '').replace(/[^0-9]/g, '')
    if (digits.length !== 7) return
    setZipLoading(true)
    setZipError('')
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`)
      const json = await res.json()
      if (json.status === 200 && json.results && json.results.length) {
        const r = json.results[0]
        const full = `${r.address1}${r.address2}${r.address3}`
        setForm((f) => ({ ...f, address: full + (f.address.startsWith(full) ? f.address.slice(full.length) : '') }))
      } else {
        setZipError('該当する住所が見つかりませんでした。')
      }
    } catch {
      setZipError('住所の自動取得に失敗しました。手動で入力してください。')
    }
    setZipLoading(false)
  }

  const onPostalChange = (v) => {
    setField('postal_code', v)
    const digits = v.replace(/[^0-9]/g, '')
    if (digits.length === 7) lookupZip(v)
  }

  const onSave = async (e) => {
    e.preventDefault()
    setErrors([])
    if (!form.name.trim()) {
      setErrors(['氏名は必須です。'])
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      kana: form.kana.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      postal_code: form.postal_code.trim(),
      address: form.address.trim(),
      start_datetime: form.start_datetime || null,
      memo: form.memo.trim(),
      status: form.status,
      updated_at: new Date().toISOString(),
    }

    let custId = id
    if (custId) {
      const { error } = await supabase.from('crm_customers').update(payload).eq('id', custId)
      if (error) { setErrors([error.message]); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('crm_customers').insert(payload).select().single()
      if (error) { setErrors([error.message]); setSaving(false); return }
      custId = data.id
    }

    // 場所: 削除して非空行を再登録
    await supabase.from('crm_locations').delete().eq('customer_id', custId)
    const rows = locs
      .map((l, i) => ({ ...l, sort_order: i }))
      .filter((l) => l.label.trim() || l.address.trim() || l.note.trim())
      .map((l) => ({
        customer_id: custId,
        label: l.label.trim(),
        address: l.address.trim(),
        note: l.note.trim(),
        sort_order: l.sort_order,
      }))
    if (rows.length) {
      const { error } = await supabase.from('crm_locations').insert(rows)
      if (error) { setErrors([error.message]); setSaving(false); return }
    }

    // 新規登録時のみ: チェックの入ったチャネルの初回履歴をまとめて登録
    if (!id) {
      for (const ch of ['online', 'retail', 'offline']) {
        if (!chanEnable[ch]) continue
        const rows2 = chanRows[ch]
        if (!rows2 || !rows2.length) continue
        const payloads = rows2.map((f) => {
          if (ch === 'online') {
            const testing = onlineNeedsTestPeriod(f.service_name, f.plan)
            return {
              customer_id: custId,
              service_name: f.service_name,
              plan: f.plan.trim() || null,
              purchase_date: f.purchase_date || today(),
              note: f.note.trim() || null,
              test_period: testing ? f.test_period : null,
              test_end_date: testing ? calcTestEndDate(f.purchase_date || today(), f.test_period) : null,
            }
          } else if (ch === 'retail') {
            const testing = retailNeedsTestPeriod(f.product_name)
            const needsLevel = retailNeedsLevel(f.product_name)
            return {
              customer_id: custId,
              product_name: f.product_name,
              quantity: Math.max(1, Number(f.quantity) || 1),
              level: needsLevel ? f.level : null,
              purchase_date: f.purchase_date || today(),
              note: f.note.trim() || null,
              test_period: testing ? f.test_period : null,
              test_end_date: testing ? calcTestEndDate(f.purchase_date || today(), f.test_period) : null,
            }
          }
          return {
            customer_id: custId,
            visit_type: f.visit_type,
            visit_date: f.visit_date || today(),
            price: offlineNeedsPrice(f.visit_type) && f.price !== '' ? Number(f.price) : null,
            notes: f.notes.trim() || null,
          }
        })
        const { error: chErr } = await supabase.from(CHANNELS[ch].table).insert(payloads)
        if (chErr) { setErrors((er) => [...er, `${CHANNELS[ch].label}: ${chErr.message}`]) }
      }
    }

    setSaving(false)
    showFlash(id ? '顧客情報を更新しました。' : '顧客を登録しました。')
    navigate(`/customer/view?id=${custId}`)
  }

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !id) return
    if (photos.length + files.length > MAX_PHOTOS) {
      setErrors([`写真は最大${MAX_PHOTOS}枚までです。`])
      return
    }
    setUploading(true)
    setErrors([])
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        setErrors((er) => [...er, `${file.name} は8MBを超えています。`])
        continue
      }
      const ext = file.name.split('.').pop()
      const path = `${id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file)
      if (upErr) { setErrors((er) => [...er, upErr.message]); continue }
      await supabase.from('crm_photos').insert({ customer_id: id, path, caption: '' })
    }
    await loadPhotos()
    setUploading(false)
    e.target.value = ''
  }

  const onDeletePhoto = async (photo) => {
    if (!window.confirm('この写真を削除しますか?')) return
    await supabase.storage.from(PHOTO_BUCKET).remove([photo.path])
    await supabase.from('crm_photos').delete().eq('id', photo.id)
    await loadPhotos()
  }

  if (loading) return <p className="muted">読み込み中…</p>

  return (
    <>
      <h1>{id ? '顧客編集' : '新規顧客登録'}</h1>
      <p className="sub">{id ? `ID ${id}` : '基本情報を入力して登録してください。写真は登録後に追加できます。'}</p>

      {errors.length > 0 && <div className="err">{errors.join('\n')}</div>}

      <form onSubmit={onSave}>
        <div className="panel">
          <h2 style={{ marginTop: 0, border: 'none' }}>顧客情報</h2>
          <div className="grid2">
            <div className="field">
              <label>氏名 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
            </div>
            <div className="field">
              <label>フリガナ</label>
              <input type="text" value={form.kana} onChange={(e) => setField('kana', e.target.value)} />
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label>電話番号</label>
              <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div className="field">
              <label>メールアドレス</label>
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>郵便番号</label>
            <div className="row" style={{ alignItems: 'center' }}>
              <div style={{ width: 160 }}>
                <input
                  type="text"
                  value={form.postal_code}
                  onChange={(e) => onPostalChange(e.target.value)}
                  placeholder="1234567（ハイフン任意）"
                  maxLength={8}
                />
              </div>
              {zipLoading && <span className="small muted">検索中…</span>}
            </div>
            {zipError && <p className="small" style={{ color: 'var(--danger)', marginTop: 4 }}>{zipError}</p>}
            <p className="small muted" style={{ marginTop: 4 }}>7桁を入力すると住所欄に自動で反映されます（続きの番地は手動で入力してください）。</p>
          </div>
          <div className="field">
            <label>住所</label>
            <input type="text" value={form.address} onChange={(e) => setField('address', e.target.value)} />
          </div>
          {id ? (
            <div className="grid2">
              <div className="field">
                <label>開始日時</label>
                <input type="datetime-local" value={form.start_datetime} onChange={(e) => setField('start_datetime', e.target.value)} />
              </div>
              <div className="field">
                <label>状態</label>
                <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  {CUSTOMER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="field">
              <label>開始日時</label>
              <input type="datetime-local" value={form.start_datetime} onChange={(e) => setField('start_datetime', e.target.value)} />
            </div>
          )}
        </div>

        {id && (
          <div className="panel">
            <h2 style={{ marginTop: 0, border: 'none' }}>サービス提供場所（最大{MAX_LOCATIONS}件）</h2>
            <p className="small muted">場所名・住所・備考。空欄の行は保存されません。</p>
            <table>
              <thead><tr><th style={{ width: 32 }}>#</th><th>場所名</th><th>住所</th><th>備考</th></tr></thead>
              <tbody>
                {locs.map((l, i) => (
                  <tr key={i}>
                    <td className="muted center">{i + 1}</td>
                    <td><input type="text" value={l.label} onChange={(e) => setLoc(i, 'label', e.target.value)} /></td>
                    <td><input type="text" value={l.address} onChange={(e) => setLoc(i, 'address', e.target.value)} /></td>
                    <td><input type="text" value={l.note} onChange={(e) => setLoc(i, 'note', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="panel">
          <h2 style={{ marginTop: 0, border: 'none' }}>メモ記入欄</h2>
          <div className="field">
            <textarea rows={5} value={form.memo} onChange={(e) => setField('memo', e.target.value)} placeholder="施術内容、体調、注意事項など" />
          </div>
        </div>

        {!id && (
          <div className="panel">
            <h2 style={{ marginTop: 0, border: 'none' }}>初回サービス記録: オンライン・小売・オフライン（任意）</h2>
            <p className="small muted">登録と同時に3チャネルの履歴も記録できます。使うチャネルにチェックを入れてから入力してください（チェックなしの内容は保存されません）。</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={chanEnable.online}
                  onChange={(e) => toggleChan('online', e.target.checked)}
                />
                <span className={`badge ch-online`}>1. {CHANNELS.online.label}</span>
              </label>
              <div style={{ marginTop: 10 }}>
                {chanRows.online.map((f, idx) => (
                  <div key={idx} className={`chan-row ${chanEnable.online ? '' : 'chan-row-off'}`}>
                    <div className="grid2">
                      <div className="field">
                        <label>サービス名</label>
                        <select disabled={!chanEnable.online} value={f.service_name} onChange={(e) => setChanRowField('online', idx, 'service_name', e.target.value)}>
                          {CHANNELS.online.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>プラン</label>
                        {f.service_name === 'LUXE WAVE' ? (
                          <select disabled={!chanEnable.online} value={f.plan} onChange={(e) => setChanRowField('online', idx, 'plan', e.target.value)}>
                            <option value="">未選択</option>
                            {LUXE_WAVE_PLANS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input disabled={!chanEnable.online} type="text" value={f.plan} onChange={(e) => setChanRowField('online', idx, 'plan', e.target.value)} placeholder="例: 15,000円" />
                        )}
                      </div>
                    </div>

                    {onlineNeedsTestPeriod(f.service_name, f.plan) && (
                      <div className="grid2">
                        <div className="field">
                          <label>テスト期間</label>
                          <select disabled={!chanEnable.online} value={f.test_period} onChange={(e) => setChanRowField('online', idx, 'test_period', e.target.value)}>
                            {TEST_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>テスト終了予定日</label>
                          <input type="text" value={calcTestEndDate(f.purchase_date, f.test_period) || '—'} disabled />
                        </div>
                      </div>
                    )}
                    <div className="grid2">
                      <div className="field">
                        <label>購入日</label>
                        <input disabled={!chanEnable.online} type="date" value={f.purchase_date} onChange={(e) => setChanRowField('online', idx, 'purchase_date', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>備考</label>
                        <input disabled={!chanEnable.online} type="text" value={f.note} onChange={(e) => setChanRowField('online', idx, 'note', e.target.value)} />
                      </div>
                    </div>
                    {chanRows.online.length > 1 && (
                      <button type="button" className="btn sm danger" disabled={!chanEnable.online} onClick={() => removeChanRow('online', idx)}>この行を削除</button>
                    )}
                    {idx < chanRows.online.length - 1 && <div className="chan-row-sep" />}
                  </div>
                ))}
                <button type="button" className="btn sm ghost" disabled={!chanEnable.online} onClick={() => addChanRow('online')} style={{ marginTop: 4 }}>＋ もう1件追加</button>
              </div>

              {chanEnable.online && chanRows.online.some((r) => r.service_name === 'ブレーカー') && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <h3 style={{ fontSize: 14, margin: '0 0 4px' }}>サービス提供場所（最大{MAX_LOCATIONS}件）</h3>
                  <p className="small muted">「ブレーカー」選択時に入力できます。場所名・住所・備考。空欄の行は保存されません。</p>
                  <table>
                    <thead><tr><th style={{ width: 32 }}>#</th><th>場所名</th><th>住所</th><th>備考</th></tr></thead>
                    <tbody>
                      {locs.map((l, i) => (
                        <tr key={i}>
                          <td className="muted center">{i + 1}</td>
                          <td><input type="text" value={l.label} onChange={(e) => setLoc(i, 'label', e.target.value)} /></td>
                          <td><input type="text" value={l.address} onChange={(e) => setLoc(i, 'address', e.target.value)} /></td>
                          <td><input type="text" value={l.note} onChange={(e) => setLoc(i, 'note', e.target.value)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={chanEnable.retail}
                  onChange={(e) => toggleChan('retail', e.target.checked)}
                />
                <span className={`badge ch-retail`}>2. {CHANNELS.retail.label}</span>
              </label>
              <div style={{ marginTop: 10 }}>
                {chanRows.retail.map((f, idx) => (
                  <div key={idx} className={`chan-row ${chanEnable.retail ? '' : 'chan-row-off'}`}>
                    <div className="grid3">
                      <div className="field">
                        <label>商品名</label>
                        <select disabled={!chanEnable.retail} value={f.product_name} onChange={(e) => setChanRowField('retail', idx, 'product_name', e.target.value)}>
                          {CHANNELS.retail.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>数量</label>
                        <input disabled={!chanEnable.retail} type="number" min="1" value={f.quantity} onChange={(e) => setChanRowField('retail', idx, 'quantity', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>購入日</label>
                        <input disabled={!chanEnable.retail} type="date" value={f.purchase_date} onChange={(e) => setChanRowField('retail', idx, 'purchase_date', e.target.value)} />
                      </div>
                    </div>

                    {retailNeedsLevel(f.product_name) && (
                      <div className="field">
                        <label>Level</label>
                        <select disabled={!chanEnable.retail} value={f.level} onChange={(e) => setChanRowField('retail', idx, 'level', e.target.value)}>
                          {NECKLACE_LEVELS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )}

                    {retailNeedsTestPeriod(f.product_name) && (
                      <div className="grid2">
                        <div className="field">
                          <label>テスト期間</label>
                          <select disabled={!chanEnable.retail} value={f.test_period} onChange={(e) => setChanRowField('retail', idx, 'test_period', e.target.value)}>
                            {TEST_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>テスト終了予定日</label>
                          <input type="text" value={calcTestEndDate(f.purchase_date, f.test_period) || '—'} disabled />
                        </div>
                      </div>
                    )}

                    <div className="field">
                      <label>備考</label>
                      <input disabled={!chanEnable.retail} type="text" value={f.note} onChange={(e) => setChanRowField('retail', idx, 'note', e.target.value)} />
                    </div>
                    {chanRows.retail.length > 1 && (
                      <button type="button" className="btn sm danger" disabled={!chanEnable.retail} onClick={() => removeChanRow('retail', idx)}>この行を削除</button>
                    )}
                    {idx < chanRows.retail.length - 1 && <div className="chan-row-sep" />}
                  </div>
                ))}
                <button type="button" className="btn sm ghost" disabled={!chanEnable.retail} onClick={() => addChanRow('retail')} style={{ marginTop: 4 }}>＋ もう1件追加</button>
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={chanEnable.offline}
                  onChange={(e) => toggleChan('offline', e.target.checked)}
                />
                <span className={`badge ch-offline`}>3. {CHANNELS.offline.label}</span>
              </label>
              <div style={{ marginTop: 10 }}>
                {chanRows.offline.map((f, idx) => (
                  <div key={idx} className={`chan-row ${chanEnable.offline ? '' : 'chan-row-off'}`}>
                    <div className="grid2">
                      <div className="field">
                        <label>サービス名</label>
                        <select disabled={!chanEnable.offline} value={f.visit_type} onChange={(e) => setChanRowField('offline', idx, 'visit_type', e.target.value)}>
                          {CHANNELS.offline.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label>来店日</label>
                        <input disabled={!chanEnable.offline} type="date" value={f.visit_date} onChange={(e) => setChanRowField('offline', idx, 'visit_date', e.target.value)} />
                      </div>
                    </div>

                    {offlineNeedsPrice(f.visit_type) && (
                      <div className="field">
                        <label>価格(円)</label>
                        <input disabled={!chanEnable.offline} type="number" min="0" value={f.price} onChange={(e) => setChanRowField('offline', idx, 'price', e.target.value)} placeholder="例: 15,000" />
                      </div>
                    )}

                    <div className="field">
                      <label>スタッフメモ</label>
                      <textarea disabled={!chanEnable.offline} rows={3} value={f.notes} onChange={(e) => setChanRowField('offline', idx, 'notes', e.target.value)} placeholder="例: 3回目施術、肌良好" />
                    </div>
                    {chanRows.offline.length > 1 && (
                      <button type="button" className="btn sm danger" disabled={!chanEnable.offline} onClick={() => removeChanRow('offline', idx)}>この行を削除</button>
                    )}
                    {idx < chanRows.offline.length - 1 && <div className="chan-row-sep" />}
                  </div>
                ))}
                <button type="button" className="btn sm ghost" disabled={!chanEnable.offline} onClick={() => addChanRow('offline')} style={{ marginTop: 4 }}>＋ もう1件追加</button>
              </div>
            </div>
          </div>
        )}

        <div className="actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? '保存中…' : id ? '更新する' : '登録する'}
          </button>
          <a className="btn ghost" onClick={() => navigate(id ? `/customer/view?id=${id}` : '/')}>キャンセル</a>
        </div>
      </form>

      {id && (
        <div className="panel" style={{ marginTop: 24 }}>
          <h2 style={{ marginTop: 0, border: 'none' }}>
            写真管理（最大{MAX_PHOTOS}枚 / 現在 {photos.length}枚）
          </h2>
          {photos.length > 0 && (
            <div className="photos" style={{ marginBottom: 16 }}>
              {photos.map((ph) => (
                <div className="photo" key={ph.id}>
                  <img src={ph.url} alt="" />
                  <button className="btn danger sm del" onClick={() => onDeletePhoto(ph)}>削除</button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS ? (
            <>
              <input type="file" accept="image/*" multiple onChange={onUpload} disabled={uploading} />
              <p className="small muted">JPEG / PNG / WebP / GIF、1枚8MBまで。複数選択できます。</p>
              {uploading && <p className="small muted">アップロード中…</p>}
            </>
          ) : (
            <p className="muted">写真は上限（{MAX_PHOTOS}枚）に達しています。</p>
          )}
        </div>
      )}
    </>
  )
}
