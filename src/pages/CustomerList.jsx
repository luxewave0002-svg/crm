import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { navigate } from '../App.jsx'

function yen(n) {
  return '¥' + Number(n || 0).toLocaleString()
}
function statusLabel(s) {
  if (s === 'paid') return '入金済み'
  if (s === 'partial') return '一部入金'
  return '未入金'
}
function custStatusLabel(s) {
  if (s === 'active') return '稼働中'
  if (s === 'inactive') return '停止'
  if (s === 'pending') return '保留'
  if (s === 'unpaid') return '未入金'
  return s
}
function custStatusClass(s) {
  if (s === 'active') return 'cust-active'
  if (s === 'unpaid') return 'cust-unpaid'
  if (s === 'pending') return 'cust-pending'
  return 'cust-inactive'
}

function csvEscape(v) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function exportCsv(customers, payMap, thisYm) {
  const headers = [
    '氏名', 'フリガナ', '電話番号', 'メールアドレス', '郵便番号', '住所',
    '開始日時', '状態', `当月(${thisYm})入金状況`, `当月予定額`, `当月入金額`, 'メモ',
  ]
  const rows = customers.map((c) => {
    const p = payMap[c.id]
    return [
      c.name, c.kana, c.phone, c.email, c.postal_code, c.address,
      c.start_datetime ? c.start_datetime.replace('T', ' ') : '',
      custStatusLabel(c.status),
      p ? statusLabel(p.status) : '未入金',
      p ? p.expected_amount : 0,
      p ? p.paid_amount : 0,
      c.memo,
    ]
  })
  const lines = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const bom = '\uFEFF' // Excelでの文字化け防止
  const blob = new Blob([bom + lines], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const today = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `顧客一覧_${today}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function CustomerList({ showFlash, flash }) {
  const [q, setQ] = useState('')
  const [customers, setCustomers] = useState([])
  const [payMap, setPayMap] = useState({})
  const [loading, setLoading] = useState(true)

  const thisYm = new Date().toISOString().slice(0, 7)

  const load = async (keyword) => {
    setLoading(true)
    let query = supabase.from('crm_customers').select('*').order('id', { ascending: false })
    if (keyword) {
      const kw = `%${keyword}%`
      query = query.or(
        `name.ilike.${kw},kana.ilike.${kw},phone.ilike.${kw},email.ilike.${kw},address.ilike.${kw}`
      )
    }
    const { data: custs, error } = await query
    if (error) {
      console.error(error)
      setLoading(false)
      return
    }
    setCustomers(custs || [])

    if (custs && custs.length) {
      const ids = custs.map((c) => c.id)
      const { data: pays } = await supabase
        .from('crm_payments')
        .select('*')
        .eq('ym', thisYm)
        .in('customer_id', ids)
      const map = {}
      ;(pays || []).forEach((p) => (map[p.customer_id] = p))
      setPayMap(map)
    } else {
      setPayMap({})
    }
    setLoading(false)
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSearch = (e) => {
    e.preventDefault()
    load(q)
  }

  return (
    <>
      {flash && <div className="flash">{flash}</div>}
      <h1>顧客一覧</h1>
      <p className="sub">
        登録 {customers.length} 件{q ? `（「${q}」で検索）` : ''} ・ 当月 {thisYm} の入金状況を表示
      </p>

      <div className="panel">
        <form className="row" onSubmit={onSearch}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="氏名・フリガナ・電話・メール・住所で検索"
            />
          </div>
          <button className="btn primary" type="submit">検索</button>
          {q && (
            <a
              className="btn ghost"
              onClick={() => {
                setQ('')
                load('')
              }}
            >
              クリア
            </a>
          )}
          <a className="btn" onClick={() => navigate('/customer/new')}>＋ 新規顧客</a>
          <button
            type="button"
            className="btn"
            onClick={() => exportCsv(customers, payMap, thisYm)}
            disabled={!customers.length}
          >
            CSVエクスポート
          </button>
        </form>
      </div>

      <div className="panel">
        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : !customers.length ? (
          <p className="muted">顧客がまだ登録されていません。「＋ 新規顧客」から登録してください。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>氏名</th>
                <th>連絡先</th>
                <th>開始日時</th>
                <th className="center">当月入金</th>
                <th className="right">操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const p = payMap[c.id]
                const st = p?.status || 'unpaid'
                return (
                  <tr key={c.id}>
                    <td>
                      <a onClick={() => navigate(`/customer/view?id=${c.id}`)}>
                        <strong>{c.name}</strong>
                      </a>{' '}
                      <span className={`badge ${custStatusClass(c.status)}`}>{custStatusLabel(c.status)}</span>
                      {c.kana && <div className="small muted">{c.kana}</div>}
                    </td>
                    <td className="small">
                      {c.phone || ''}
                      {c.email && <div className="muted">{c.email}</div>}
                    </td>
                    <td className="small">
                      {c.start_datetime ? new Date(c.start_datetime).toLocaleString('ja-JP') : <span className="muted">未設定</span>}
                    </td>
                    <td className="center">
                      <span className={`badge ${st}`}>{statusLabel(st)}</span>
                      {p && p.expected_amount > 0 && (
                        <div className="small muted">
                          {yen(p.paid_amount)} / {yen(p.expected_amount)}
                        </div>
                      )}
                    </td>
                    <td className="right">
                      <a className="btn sm" onClick={() => navigate(`/customer/view?id=${c.id}`)}>詳細</a>{' '}
                      <a className="btn sm" onClick={() => navigate(`/customer/edit?id=${c.id}`)}>編集</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
