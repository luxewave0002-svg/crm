import React, { useEffect, useState, useCallback } from 'react'
import { supabase, PHOTO_BUCKET, custStatusLabel, custStatusClass, downloadCsv } from '../supabaseClient'
import { navigate } from '../App.jsx'
import ChannelEntry from './ChannelEntry.jsx'
import ServiceTimeline from './ServiceTimeline.jsx'

const today = () => new Date().toISOString().slice(0, 10)

function yen(n) { return '¥' + Number(n || 0).toLocaleString() }
function statusLabel(s) {
  if (s === 'paid') return '入金済み'
  if (s === 'partial') return '一部入金'
  return '未入金'
}
function effectivePrice(c) {
  let price = Number(c.price || 0)
  const d = Number(c.discount || 0)
  if (c.discount_type === 'percent') price = Math.round((price * (100 - d)) / 100)
  else price -= d
  return Math.max(0, price)
}
function judgeStatus(expected, paid) {
  if (paid <= 0) return 'unpaid'
  if (expected > 0 && paid >= expected) return 'paid'
  return 'partial'
}
const CH_LABEL = { online: 'オンライン', retail: '小売', offline: 'オフライン' }

function exportCustomerCsv(customer, locs, contracts, payDraft, year, events) {
  const rows = []

  rows.push(['顧客情報'])
  rows.push(['氏名', 'フリガナ', '電話番号', 'メールアドレス', '郵便番号', '住所', '開始日時', '状態', 'メモ'])
  rows.push([
    customer.name, customer.kana, customer.phone, customer.email,
    customer.postal_code, customer.address,
    customer.start_datetime ? customer.start_datetime.replace('T', ' ') : '',
    custStatusLabel(customer.status), customer.memo,
  ])
  rows.push([])

  rows.push(['サービス提供場所'])
  rows.push(['#', '場所名', '住所', '備考'])
  if (!locs.length) rows.push(['—', '', '', ''])
  locs.forEach((l, i) => rows.push([i + 1, l.label, l.address, l.note]))
  rows.push([])

  rows.push(['契約プラン・価格・割引'])
  rows.push(['プラン名', '開始日', '終了日', '価格', '割引', '割引種別', '月額', '備考'])
  if (!contracts.length) rows.push(['—', '', '', '', '', '', '', ''])
  contracts.forEach((c) => rows.push([
    c.plan_name, c.start_date || '', c.end_date || '',
    c.price, c.discount, c.discount_type === 'percent' ? '%引き' : '円引き',
    c.monthly_fee, c.note,
  ]))
  rows.push([])

  rows.push([`入金管理(${year}年)`])
  rows.push(['月', '予定額', '入金額', '入金日', '状態', 'メモ'])
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const d = payDraft[ym] || {}
    rows.push([`${m}月`, d.expected_amount ?? 0, d.paid_amount ?? 0, d.paid_date || '', statusLabel(d.status), d.note || ''])
  }
  rows.push([])

  rows.push(['サービス履歴(オンライン・小売・オフライン)'])
  rows.push(['日付', 'チャネル', '項目', '詳細', '備考'])
  if (!events.length) rows.push(['—', '', '', '', ''])
  events.forEach((ev) => rows.push([ev.date, CH_LABEL[ev.channel] || ev.channel, ev.title, ev.sub, ev.note]))

  const fname = `顧客_${customer.name}_${today()}.csv`
  downloadCsv(fname, rows)
}

export default function CustomerView({ id, showFlash }) {
  const [customer, setCustomer] = useState(null)
  const [locs, setLocs] = useState([])
  const [photos, setPhotos] = useState([])
  const [contracts, setContracts] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [payments, setPayments] = useState({}) // ym -> row
  const [payDraft, setPayDraft] = useState({}) // ym -> editable row
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: cust } = await supabase.from('crm_customers').select('*').eq('id', id).single()
    setCustomer(cust)

    const { data: locRows } = await supabase.from('crm_locations').select('*').eq('customer_id', id).order('sort_order')
    setLocs(locRows || [])

    const { data: photoRows } = await supabase.from('crm_photos').select('*').eq('customer_id', id).order('id')
    const withUrls = await Promise.all(
      (photoRows || []).map(async (p) => {
        const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(p.path, 3600)
        return { ...p, url: signed?.signedUrl }
      })
    )
    setPhotos(withUrls)

    const { data: contractRows } = await supabase
      .from('crm_contracts').select('*').eq('customer_id', id)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
    setContracts(contractRows || [])

    setLoading(false)
  }, [id])

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from('crm_payments').select('*').eq('customer_id', id)
      .like('ym', `${year}-%`)
    const map = {}
    ;(data || []).forEach((r) => (map[r.ym] = r))
    setPayments(map)
    const draft = {}
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`
      const r = map[ym]
      draft[ym] = {
        expected_amount: r?.expected_amount ?? 0,
        paid_amount: r?.paid_amount ?? 0,
        paid_date: r?.paid_date ?? '',
        status: r?.status ?? 'unpaid',
        note: r?.note ?? '',
      }
    }
    setPayDraft(draft)
  }, [id, year])

  const loadEvents = useCallback(async () => {
    const [on, re, off] = await Promise.all([
      supabase.from('crm_service_online').select('*').eq('customer_id', id),
      supabase.from('crm_service_retail').select('*').eq('customer_id', id),
      supabase.from('crm_service_offline_visits').select('*').eq('customer_id', id),
    ])
    const list = [
      ...(on.data || []).map((r) => ({
        channel: 'online', id: r.id, date: r.purchase_date,
        title: r.service_name,
        sub: [r.plan, r.test_end_date ? `テスト終了予定 ${r.test_end_date}` : null].filter(Boolean).join(' / '),
        note: r.note || '',
        expired: !!(r.test_end_date && r.test_end_date < today()),
        created_at: r.created_at,
      })),
      ...(re.data || []).map((r) => ({
        channel: 'retail', id: r.id, date: r.purchase_date,
        title: r.product_name,
        sub: [r.level, r.quantity > 1 ? `×${r.quantity}` : null, r.test_end_date ? `テスト終了予定 ${r.test_end_date}` : null].filter(Boolean).join(' / '),
        note: r.note || '',
        expired: !!(r.test_end_date && r.test_end_date < today()),
        created_at: r.created_at,
      })),
      ...(off.data || []).map((r) => ({
        channel: 'offline', id: r.id, date: r.visit_date,
        title: r.visit_type,
        sub: r.price ? `¥${Number(r.price).toLocaleString()}` : '',
        note: r.notes || '',
        created_at: r.created_at,
      })),
    ]
    list.sort((a, b) => {
      const d = String(b.date || '').localeCompare(String(a.date || ''))
      if (d !== 0) return d
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
    setEvents(list)
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadPayments() }, [loadPayments])
  useEffect(() => { loadEvents() }, [loadEvents])

  const onDeleteCustomer = async () => {
    if (!window.confirm('この顧客を関連データごと削除します。よろしいですか?')) return
    for (const p of photos) {
      await supabase.storage.from(PHOTO_BUCKET).remove([p.path])
    }
    await supabase.from('crm_customers').delete().eq('id', id)
    showFlash(`顧客「${customer.name}」を削除しました。`)
    navigate('/')
  }

  const setDraft = (ym, k, v) => setPayDraft((d) => ({ ...d, [ym]: { ...d[ym], [k]: v } }))

  const saveMonth = async (ym) => {
    const d = payDraft[ym]
    let status = d.status
    const expected = Number(d.expected_amount || 0)
    const paid = Number(d.paid_amount || 0)
    if (status === 'unpaid' && paid > 0) status = judgeStatus(expected, paid)

    const { error } = await supabase.from('crm_payments').upsert(
      {
        customer_id: id, ym,
        expected_amount: expected, paid_amount: paid,
        paid_date: d.paid_date || null, status, note: d.note || '',
      },
      { onConflict: 'customer_id,ym' }
    )
    if (!error) {
      showFlash(`${ym} の入金情報を保存しました。`)
      loadPayments()
    }
  }

  const bulkExpected = async () => {
    const monthly = activeMonthly
    if (!monthly) return
    if (!window.confirm(`未入金の各月の予定金額を月額${monthly}円で一括セットします。よろしいですか?`)) return
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`
      const existing = payments[ym]
      if (existing && existing.status === 'paid') continue
      await supabase.from('crm_payments').upsert(
        { customer_id: id, ym, expected_amount: monthly, status: existing?.status || 'unpaid' },
        { onConflict: 'customer_id,ym' }
      )
    }
    showFlash('予定金額を一括セットしました。')
    loadPayments()
  }

  if (loading || !customer) return <p className="muted">読み込み中…</p>

  const activeMonthly = contracts.find((c) => Number(c.monthly_fee) > 0)?.monthly_fee || 0
  let yearPaid = 0, yearExpected = 0
  Object.values(payments).forEach((r) => { yearPaid += Number(r.paid_amount || 0); yearExpected += Number(r.expected_amount || 0) })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1>
            {customer.name}{' '}
            <span className={`badge ${custStatusClass(customer.status)}`}>{custStatusLabel(customer.status)}</span>
          </h1>
          <p className="sub">
            {customer.kana ? `${customer.kana} ・ ` : ''}
            開始 {customer.start_datetime ? new Date(customer.start_datetime).toLocaleString('ja-JP') : '未設定'}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => exportCustomerCsv(customer, locs, contracts, payDraft, year, events)}>CSVエクスポート</button>
          <a className="btn" onClick={() => navigate(`/customer/edit?id=${id}`)}>編集</a>
          <button className="btn danger" onClick={onDeleteCustomer}>削除</button>
        </div>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, border: 'none' }}>顧客情報</h2>
        <div className="grid3">
          <div><div className="small muted">電話</div>{customer.phone || <span className="muted">—</span>}</div>
          <div><div className="small muted">メール</div>{customer.email || <span className="muted">—</span>}</div>
          <div><div className="small muted">住所</div>
            {customer.postal_code && <span className="muted">〒{customer.postal_code} </span>}
            {customer.address || <span className="muted">—</span>}
          </div>
        </div>
        {customer.memo && (
          <div style={{ marginTop: 16 }}>
            <div className="small muted">メモ</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{customer.memo}</div>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, border: 'none' }}>サービス提供場所（{locs.length}件）</h2>
        {!locs.length ? <p className="muted">未登録</p> : (
          <table>
            <thead><tr><th style={{ width: 32 }}>#</th><th>場所名</th><th>住所</th><th>備考</th></tr></thead>
            <tbody>
              {locs.map((l, i) => (
                <tr key={l.id}>
                  <td className="muted center">{i + 1}</td>
                  <td>{l.label || <span className="muted">—</span>}</td>
                  <td>{l.address || <span className="muted">—</span>}</td>
                  <td className="small">{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0, border: 'none' }}>写真（{photos.length}枚）</h2>
        {!photos.length ? (
          <p className="muted">未登録 ・ <a onClick={() => navigate(`/customer/edit?id=${id}`)}>写真を追加</a></p>
        ) : (
          <div className="photos">
            {photos.map((ph) => (
              <div className="photo" key={ph.id}>
                <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.url} alt="" /></a>
              </div>
            ))}
          </div>
        )}
      </div>

      <ChannelEntry customerId={id} onSaved={loadEvents} showFlash={showFlash} />

      <ServiceTimeline events={events} onChanged={loadEvents} showFlash={showFlash} />

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, border: 'none' }}>契約プラン・価格・割引（履歴 {contracts.length}件）</h2>
          <a className="btn sm" onClick={() => navigate(`/contract?customer_id=${id}`)}>＋ 契約を追加</a>
        </div>
        <div className="spacer" />
        {!contracts.length ? <p className="muted">契約が登録されていません。</p> : (
          <table>
            <thead>
              <tr><th>プラン</th><th>期間</th><th className="right">価格</th><th className="right">割引</th><th className="right">実質</th><th className="right">月額</th><th className="right">操作</th></tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.plan_name || <span className="muted">（無題）</span>}</strong>
                    {c.note && <div className="small muted">{c.note}</div>}
                  </td>
                  <td className="small">{c.start_date || '—'}{c.end_date ? ` 〜 ${c.end_date}` : ''}</td>
                  <td className="right">{yen(c.price)}</td>
                  <td className="right">{Number(c.discount) ? (c.discount_type === 'percent' ? `${c.discount}%` : yen(c.discount)) : '—'}</td>
                  <td className="right"><strong>{yen(effectivePrice(c))}</strong></td>
                  <td className="right">{Number(c.monthly_fee) ? yen(c.monthly_fee) : '—'}</td>
                  <td className="right">
                    <a className="btn sm" onClick={() => navigate(`/contract?customer_id=${id}&id=${c.id}`)}>編集</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, border: 'none' }}>入金管理（{year}年）</h2>
          <div className="row" style={{ alignItems: 'center' }}>
            <a className="btn sm ghost" onClick={() => setYear((y) => y - 1)}>◀ {year - 1}</a>
            <a className="btn sm ghost" onClick={() => setYear((y) => y + 1)}>{year + 1} ▶</a>
          </div>
        </div>
        <p className="small muted">
          年間 入金 {yen(yearPaid)} / 予定 {yen(yearExpected)}
          {activeMonthly ? ` ・ 参考月額 ${yen(activeMonthly)}` : ''}
        </p>

        {activeMonthly > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button className="btn sm" onClick={bulkExpected}>予定金額を月額で一括セット</button>
          </div>
        )}

        <table>
          <thead>
            <tr><th>月</th><th className="right">予定</th><th className="right">入金額</th><th>入金日</th><th className="center">状態</th><th>メモ</th><th></th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const ym = `${year}-${String(m).padStart(2, '0')}`
              const d = payDraft[ym] || {}
              return (
                <tr key={ym}>
                  <td>
                    <strong>{m}月</strong>{' '}
                    <span className={`badge ${d.status || 'unpaid'}`} style={{ marginLeft: 4 }}>
                      {statusLabel(d.status)}
                    </span>
                  </td>
                  <td className="right" style={{ width: 110 }}>
                    <input type="number" value={d.expected_amount ?? 0}
                      onChange={(e) => setDraft(ym, 'expected_amount', e.target.value)}
                      style={{ textAlign: 'right' }} />
                  </td>
                  <td className="right" style={{ width: 110 }}>
                    <input type="number" value={d.paid_amount ?? 0}
                      onChange={(e) => setDraft(ym, 'paid_amount', e.target.value)}
                      style={{ textAlign: 'right' }} />
                  </td>
                  <td style={{ width: 150 }}>
                    <input type="date" value={d.paid_date || ''}
                      onChange={(e) => setDraft(ym, 'paid_date', e.target.value)} />
                  </td>
                  <td className="center" style={{ width: 120 }}>
                    <select value={d.status || 'unpaid'} onChange={(e) => setDraft(ym, 'status', e.target.value)}>
                      <option value="unpaid">未入金</option>
                      <option value="partial">一部入金</option>
                      <option value="paid">入金済み</option>
                    </select>
                  </td>
                  <td>
                    <input type="text" value={d.note || ''} onChange={(e) => setDraft(ym, 'note', e.target.value)} placeholder="—" />
                  </td>
                  <td><button className="btn sm primary" onClick={() => saveMonth(ym)}>保存</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="small muted">各月の行ごとに「保存」を押すと記録されます。状態は金額に応じて自動判定もされます（予定額以上=入金済み、1円以上=一部入金）。</p>
      </div>

      <p><a onClick={() => navigate('/')}>← 顧客一覧へ戻る</a></p>
    </>
  )
}
