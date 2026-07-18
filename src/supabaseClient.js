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
    options: ['LUXE WAVE', 'ブレーカー'],
  },
  retail: {
    key: 'retail',
    label: '小売商品',
    short: '小売',
    table: 'crm_service_retail',
    options: ['ruNe', 'ネックレス', 'スマートプラグ'],
  },
  offline: {
    key: 'offline',
    label: 'オフラインサービス',
    short: 'オフライン',
    table: 'crm_service_offline_visits',
    options: ['光治療'],
  },
}
