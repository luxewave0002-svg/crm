import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError('メールアドレスまたはパスワードが違います。')
    }
  }

  return (
    <div className="wrap">
      <div className="login-box">
        <h1>Luxe Wave CRM</h1>
        {error && <div className="err">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn primary" style={{ width: '100%' }} type="submit" disabled={loading}>
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>
          初期アカウント: admin@luxewave.jp / admin0000
        </p>
      </div>
    </div>
  )
}
