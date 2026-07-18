-- =====================================================================
-- Luxe Wave CRM — 3チャネル履歴スキーマ (schema.sql)
--
-- 適用先: Supabase (Postgres) プロジェクト zihodrbmnxdjtppntrnz
-- 状態  : 適用済み (migration: crm_channels_online_retail_offline)
--
-- 【設計方針】
-- 顧客テーブルは新設せず、既存の crm_customers を単一の正とする。
-- 3チャネルの履歴を customer_id で crm_customers に外部キー参照させることで、
-- 既存の契約(crm_contracts)・入金(crm_payments)・写真(crm_photos)・
-- 提供場所(crm_locations)と同一顧客IDのもとに一元化される。
--
-- チャネル配色: 1.オンライン=青 / 2.小売=緑 / 3.オフライン=橙
-- =====================================================================


-- ---------------------------------------------------------------------
-- 参考: 既存の顧客テーブル (今回は新規作成せず、これを利用する)
-- ---------------------------------------------------------------------
-- create table crm_customers (
--   id             bigint generated always as identity primary key,
--   name           text not null,
--   kana           text,
--   phone          text,
--   email          text,
--   postal_code    text,
--   address        text,
--   start_datetime timestamptz,
--   memo           text,
--   status         text default 'active',  -- active/inactive/pending/unpaid
--   created_at     timestamptz default now(),
--   updated_at     timestamptz default now()
-- );


-- ---------------------------------------------------------------------
-- 1. オンラインサービス購入履歴（青）
--    選択肢: Luxe Wave / Breaker Modulation
-- ---------------------------------------------------------------------
create table if not exists crm_service_online (
  id            bigint generated always as identity primary key,
  customer_id   bigint not null references crm_customers(id) on delete cascade,
  service_name  text not null,              -- サービス名
  plan          text,                       -- プラン (例: 3ヶ月プラン)
  purchase_date date default current_date,  -- 購入日
  note          text,                       -- 備考
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. 小売商品販売履歴（緑）
--    選択肢: Beauty Serum / Necklace / Smart Plug / Supplement
-- ---------------------------------------------------------------------
create table if not exists crm_service_retail (
  id            bigint generated always as identity primary key,
  customer_id   bigint not null references crm_customers(id) on delete cascade,
  product_name  text not null,              -- 商品名
  quantity      integer default 1,          -- 数量
  purchase_date date default current_date,  -- 購入日
  note          text,                       -- 備考
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 3. オフラインサービス来店履歴（橙）
--    選択肢: Laser Treatment
-- ---------------------------------------------------------------------
create table if not exists crm_service_offline_visits (
  id          bigint generated always as identity primary key,
  customer_id bigint not null references crm_customers(id) on delete cascade,
  visit_type  text not null,                -- サービス名
  visit_date  date default current_date,    -- 来店日
  notes       text,                         -- スタッフメモ (例: 3回目施術、肌良好)
  created_at  timestamptz default now()
);


-- ---------------------------------------------------------------------
-- インデックス
-- ---------------------------------------------------------------------
create index if not exists idx_crm_online_cust  on crm_service_online(customer_id);
create index if not exists idx_crm_retail_cust  on crm_service_retail(customer_id);
create index if not exists idx_crm_offline_cust on crm_service_offline_visits(customer_id);


-- ---------------------------------------------------------------------
-- RLS: ログイン済みスタッフのみ全操作可 (既存テーブルと同一方針)
-- ---------------------------------------------------------------------
alter table crm_service_online         enable row level security;
alter table crm_service_retail         enable row level security;
alter table crm_service_offline_visits enable row level security;

drop policy if exists crm_service_online_all  on crm_service_online;
drop policy if exists crm_service_retail_all  on crm_service_retail;
drop policy if exists crm_service_offline_all on crm_service_offline_visits;

create policy crm_service_online_all  on crm_service_online
  for all to authenticated using (true) with check (true);
create policy crm_service_retail_all  on crm_service_retail
  for all to authenticated using (true) with check (true);
create policy crm_service_offline_all on crm_service_offline_visits
  for all to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------
-- 参考: 一元カルテ用の統合ビュー
-- アプリ側は3テーブルを個別取得してJS側で時系列統合しているため必須ではないが、
-- SQLで直接タイムラインを引きたい場合に利用できる。
-- ---------------------------------------------------------------------
create or replace view crm_service_timeline as
  select
    'online'::text  as channel,
    id, customer_id,
    purchase_date   as event_date,
    service_name    as title,
    plan            as sub,
    note            as body,
    created_at
  from crm_service_online
  union all
  select
    'retail'::text,
    id, customer_id,
    purchase_date,
    product_name,
    nullif('×' || quantity::text, '×1'),
    note,
    created_at
  from crm_service_retail
  union all
  select
    'offline'::text,
    id, customer_id,
    visit_date,
    visit_type,
    null,
    notes,
    created_at
  from crm_service_offline_visits;
