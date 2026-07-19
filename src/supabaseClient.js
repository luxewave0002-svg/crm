import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zihodrbmnxdjtppntrnz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaG9kcmJtbnhkanRwcG50cm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTcxNjUsImV4cCI6MjA5NDI5MzE2NX0.eY56hUf0nk0QpttCSPzYOMm6qLdYDapF0W0BnRmCUck'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const MAX_LOCATIONS = 10
export const MAX_PHOTOS = 10
export const PHOTO_BUCKET = 'crm-photos'

// 3チャネル定義 (1.オンライン=青 / 2.小売=緑 / 3.オフライン=橙)
export const CHANNELS = {
  online: {
    key: 'online',
    label: 'オンラインサービス',
    short: 'オンライン',
    table: 'crm_service_online',
    options: ['LUXE WAVE', 'ブレーカー', 'スマートプラグ'],
  },
  retail: {
    key: 'retail',
    label: '小売商品',
    short: '小売',
    table: 'crm_service_retail',
    options: ['ruNe', 'ネックレス'],
  },
  offline: {
    key: 'offline',
    label: 'オフラインサービス',
    short: 'オフライン',
    table: 'crm_service_offline_visits',
    options: ['光治療'],
  },
}

// LUXE WAVE のプラン階層(フリープラン + Level.2〜5、各テスト版あり)
export const LUXE_WAVE_PLANS = [
  'フリープラン',
  'Level.2_test', 'Level.2',
  'Level.3_test', 'Level.3',
  'Level.4_test', 'Level.4',
  'Level.5_test', 'Level.5',
]
export const isTestPlan = (plan) => typeof plan === 'string' && plan.endsWith('_test')

// テスト期間の選択肢(日数はtest_end_date算出用)
export const TEST_PERIODS = [
  { value: '2w', label: '2週間', days: 14 },
  { value: '1m', label: '1ヶ月', days: 30 },
  { value: '1.5m', label: '1.5ヶ月', days: 45 },
  { value: '2m', label: '2ヶ月', days: 60 },
]
export function calcTestEndDate(startDateStr, periodValue) {
  const p = TEST_PERIODS.find((t) => t.value === periodValue)
  if (!p || !startDateStr) return null
  const d = new Date(startDateStr + 'T00:00:00')
  d.setDate(d.getDate() + p.days)
  return d.toISOString().slice(0, 10)
}

// テスト期間の入力欄を出すかどうかの判定
// オンライン: LUXE WAVEの_testプラン、ブレーカー・スマートプラグ(常に)
// 小売: 現在は対象なし
export const ONLINE_TEST_SERVICES = ['ブレーカー', 'スマートプラグ']
export const RETAIL_TEST_PRODUCTS = []
export function onlineNeedsTestPeriod(serviceName, plan) {
  if (ONLINE_TEST_SERVICES.includes(serviceName)) return true
  if (serviceName === 'LUXE WAVE' && isTestPlan(plan)) return true
  return false
}
export function retailNeedsTestPeriod(productName) {
  return RETAIL_TEST_PRODUCTS.includes(productName)
}

// 顧客の状態(稼働中/停止/保留/未入金/テスト期間)
export const CUSTOMER_STATUSES = [
  { value: 'active', label: '稼働中', cls: 'cust-active' },
  { value: 'inactive', label: '停止', cls: 'cust-inactive' },
  { value: 'pending', label: '保留', cls: 'cust-pending' },
  { value: 'unpaid', label: '未入金', cls: 'cust-unpaid' },
  { value: 'testing', label: 'テスト期間', cls: 'cust-testing' },
]
export function custStatusLabel(v) {
  return CUSTOMER_STATUSES.find((s) => s.value === v)?.label || v
}
export function custStatusClass(v) {
  return CUSTOMER_STATUSES.find((s) => s.value === v)?.cls || 'cust-inactive'
}
