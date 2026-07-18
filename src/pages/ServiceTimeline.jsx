import React, { useState } from 'react'
import { supabase, CHANNELS } from '../supabaseClient'

const CH_LABEL = { online: 'オンライン', retail: '小売', offline: 'オフライン' }

export default function ServiceTimeline({ events, onChanged, showFlash }) {
  const [filter, setFilter] = useState('all')

  const shown = filter === 'all' ? events : events.filter((e) => e.channel === filter)

  const onDelete = async (ev) => {
    if (!window.confirm('この履歴を削除しますか?')) return
    const { error } = await supabase.from(CHANNELS[ev.channel].table).delete().eq('id', ev.id)
    if (!error) {
      showFlash('履歴を削除しました。')
      onChanged()
    }
  }

  const counts = {
    all: events.length,
    online: events.filter((e) => e.channel === 'online').length,
    retail: events.filter((e) => e.channel === 'retail').length,
    offline: events.filter((e) => e.channel === 'offline').length,
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0, border: 'none' }}>全サービス履歴（一元カルテ）</h2>
      <p className="small muted">
        オンライン・小売・オフラインの履歴を時系列で表示しています（新しい順）。
      </p>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${filter === 'all' ? 'active on-online' : ''}`}
          onClick={() => setFilter('all')}
          style={filter === 'all' ? { background: 'var(--panel2)', borderColor: 'var(--line)', color: 'var(--text)' } : undefined}
        >
          すべて ({counts.all})
        </button>
        {Object.values(CHANNELS).map((c) => (
          <button
            key={c.key}
            type="button"
            className={`tab on-${c.key} ${filter === c.key ? 'active' : ''}`}
            onClick={() => setFilter(c.key)}
          >
            {CH_LABEL[c.key]} ({counts[c.key]})
          </button>
        ))}
      </div>

      {!shown.length ? (
        <p className="muted">
          {events.length ? 'このチャネルの履歴はありません。' : 'まだ履歴がありません。上のフォームから追加してください。'}
        </p>
      ) : (
        <div className="timeline">
          {shown.map((ev) => (
            <div className="tl-item" key={`${ev.channel}-${ev.id}`}>
              <span className={`tl-dot ch-${ev.channel}`} />
              <div className="tl-head">
                <span className="tl-date">{ev.date}</span>
                <span className={`badge ch-${ev.channel}`}>{CH_LABEL[ev.channel]}</span>
                <strong>{ev.title}</strong>
                {ev.sub && <span className="small muted">{ev.sub}</span>}
                {ev.expired && <span className="badge cust-unpaid">期限切れ</span>}
                <button className="btn danger sm del" onClick={() => onDelete(ev)}>削除</button>
              </div>
              {ev.note && <div className="tl-note">{ev.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
