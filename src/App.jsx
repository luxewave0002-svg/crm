import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login.jsx'
import CustomerList from './pages/CustomerList.jsx'
import CustomerEdit from './pages/CustomerEdit.jsx'
import CustomerView from './pages/CustomerView.jsx'
import ContractEdit from './pages/ContractEdit.jsx'

function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, qs] = h.split('?')
  const params = new URLSearchParams(qs || '')
  const parts = path.split('/').filter(Boolean)
  return { parts, params }
}

export function navigate(to) {
  window.location.hash = to
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined=loading, null=logged out
  const [route, setRoute] = useState(parseHash())
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  const showFlash = useCallback((msg) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 4000)
  }, [])

  if (session === undefined) {
    return <div className="center-page">読み込み中…</div>
  }

  if (!session) {
    return <Login />
  }

  const { parts, params } = route
  const staffEmail = session.user?.email || ''

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  let page
  if (parts[0] === 'customer' && parts[1] === 'new') {
    page = <CustomerEdit id={null} showFlash={showFlash} />
  } else if (parts[0] === 'customer' && parts[1] === 'edit' && params.get('id')) {
    page = <CustomerEdit id={Number(params.get('id'))} showFlash={showFlash} />
  } else if (parts[0] === 'customer' && parts[1] === 'view' && params.get('id')) {
    page = <CustomerView id={Number(params.get('id'))} showFlash={showFlash} />
  } else if (parts[0] === 'contract' && params.get('customer_id')) {
    page = (
      <ContractEdit
        customerId={Number(params.get('customer_id'))}
        contractId={params.get('id') ? Number(params.get('id')) : null}
        showFlash={showFlash}
      />
    )
  } else {
    page = <CustomerList showFlash={showFlash} flash={flash} />
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" onClick={() => navigate('/')}>
          Luxe Wave <span>顧客管理</span>
        </a>
        <nav>
          <a onClick={() => navigate('/')}>顧客一覧</a>
          <a onClick={() => navigate('/customer/new')}>新規登録</a>
        </nav>
        <div className="me">
          <span>{staffEmail}</span>
          <a className="logout" onClick={logout}>ログアウト</a>
        </div>
      </header>
      <main className="wrap">
        {flash && parts.length > 0 && <div className="flash">{flash}</div>}
        {page}
      </main>
      <footer className="foot">電磁波変調サービス 顧客管理システム</footer>
    </>
  )
}
