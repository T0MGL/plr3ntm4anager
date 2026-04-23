-- ============================================================================
-- 013_seed_airport_units.sql
-- Import the three Park Lofts Airport units scraped from Airbnb on 2026-04-23.
--
-- Source: /tmp/park_lofts_airbnb.json (Apify scrape)
-- Airbnb listing IDs:
--   1613830118134001329  ->  Airport Lechner #309  (3rd floor)
--   1665465335055197324  ->  Airport Puschmann 202 (2nd floor, balcony)
--   1665449612509139497  ->  Airport Puschmann 201 (2nd floor, balcony, pets)
--
-- Updated 2026-04-23: real nightly rates and iCal URLs confirmed by Gaston.
--
-- Idempotent: ON CONFLICT (airbnb_ical_url) DO UPDATE replaces every
-- mutable field, so re-running after updating the ical URL placeholders
-- below is safe as long as you update the ON CONFLICT key too.
-- ============================================================================

insert into public.units (
  name,
  description,
  nightly_rate_usd,
  max_guests,
  bedrooms,
  beds,
  airbnb_listing_url,
  airbnb_ical_url,
  image_urls,
  status,
  street_address,
  city,
  state,
  country,
  neighborhood,
  latitude,
  longitude,
  google_maps_url
) values

-- --------------------------------------------------------------------------
-- Unit 1: Airport Lechner #309, 3rd floor
-- Airbnb ID: 1613830118134001329
-- Scraped rating: 5.0 (1 review)
-- --------------------------------------------------------------------------
(
  'Monoambiente moderno en Park Lofts Airport, 3er piso',
  'Monoambiente moderno en el 3er piso del edificio Park Lofts Airport, en una zona residencial tranquila y segura. A 8 minutos del aeropuerto Silvio Pettirossi, ideal para estadias cortas y largas. Cuenta con espacio de coworking en planta baja, patio trasero con cocina exterior y parrilla, acceso controlado y recepcion. Check-in por smart lock.',
  20.00,
  2,
  1,
  1,
  'https://www.airbnb.com/rooms/1613830118134001329',
  'https://www.airbnb.com.py/calendar/ical/1613830118134001329.ics?t=6b338fa60dbc454fb0c55eeb19254781',
  array[
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/56005320-04d6-4a64-a67b-fc301a23afc4.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/eb424e9e-ecf1-40cb-8106-0c8ed456ec61.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/050bf4eb-57e4-4b02-bdf5-37d332b29087.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/dac92fc9-c62f-4718-a626-9ad2df69e708.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/b0388d68-ce1c-4c6c-990a-04093d7b461c.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/24ceb5bb-0dbd-4297-9f45-561b35ca566b.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/76e9264a-9de9-47dd-96ee-05632561367b.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/4fff1631-73d5-4c80-a9b0-f69f3be3ef44.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/addc227b-5494-494f-b8d7-21233bcbfbd2.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/cdc46add-044a-4c76-b7cc-5251dbe271c6.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/f9635aae-e09b-44f6-a5a3-48eb050846de.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/a61b4305-8eee-497d-a51e-5b618a33e8bc.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/d570775e-f3b3-447e-9d65-40959d335d92.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/0da10d04-51b4-4235-b068-3f005f3166fb.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/f4814eff-b486-4681-b34d-bc1263a5343a.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/5ca2a1b0-8045-497c-9400-5f19321f2322.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1613830118134001329/original/29535c06-5fdf-4e8a-a6e7-4ac389a3f079.png'
  ],
  'active',
  'Calle Lechner, Park Lofts Airport, Piso 3 #309',
  'Asuncion',
  'Central',
  'Paraguay',
  'Aeropuerto',
  (-25.2536007)::numeric(10, 7),
  (-57.5535872)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2536007,-57.5535872'
),

-- --------------------------------------------------------------------------
-- Unit 2: Airport Puschmann 202, 2nd floor with balcony
-- Airbnb ID: 1665465335055197324
-- No reviews yet (new listing)
-- --------------------------------------------------------------------------
(
  'Estudio moderno con balcon, Park Lofts Airport, 2do piso',
  'Estudio moderno con balcon en el 2do piso de Park Lofts Airport, en zona residencial tranquila. A 8 minutos del aeropuerto, 5 minutos del Parque Nu Guazu, 7 minutos del Jardin Botanico y 15 minutos de los principales shoppings de Asuncion. Totalmente equipado. Check-in por smart lock.',
  22.00,
  2,
  1,
  1,
  'https://www.airbnb.com/rooms/1665465335055197324',
  'https://www.airbnb.com.py/calendar/ical/1665465335055197324.ics?t=8b3424f7a5454bd1ba8e5460d68d74c9',
  array[
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/0a5b56c8-587f-4969-8e1d-f5555fe72281.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/bc92f990-473f-4da8-9285-7f04ae89dd74.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/5ebb3fbc-c280-4450-ae45-f6323545428e.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/7b4341fb-1f31-45d0-bef6-78675c078bfb.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/2093701b-edaf-479f-a37b-7264beb4b2a6.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/20a6a2c9-b5d1-400e-89a2-54d2688967d4.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/7cf22c81-714e-4d9d-9a5a-eb72fb9e6439.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/d55c9ca5-a28e-4075-8289-e1d7ce707633.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/46ed8f62-cc38-4924-833e-78cb8b01df7f.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/db029b8b-8020-4f74-af91-3ed1b1ed9189.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/579c6cfa-694a-4ab1-8cc9-069b131f8d29.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665465335055197324/original/4ec5b36a-e930-4d67-8af6-8d2b563f92b9.jpeg'
  ],
  'active',
  'Calle Puschmann, Park Lofts Airport, Piso 2 #202',
  'Asuncion',
  'Central',
  'Paraguay',
  'Aeropuerto',
  (-25.2543000)::numeric(10, 7),
  (-57.5540000)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2543,-57.554'
),

-- --------------------------------------------------------------------------
-- Unit 3: Airport Puschmann 201, 2nd floor with balcony, pets allowed
-- Airbnb ID: 1665449612509139497
-- No reviews yet (new listing)
-- --------------------------------------------------------------------------
(
  'Estudio con balcon en Park Lofts Airport, 2do piso',
  'Estudio moderno con balcon en el 2do piso de Park Lofts Airport, en zona residencial tranquila. A 8 minutos del aeropuerto, 5 minutos del Parque Nu Guazu, 7 minutos del Jardin Botanico y 15 minutos de los principales shoppings de Asuncion. Mascotas bienvenidas. Totalmente equipado. Check-in por smart lock.',
  22.00,
  2,
  1,
  1,
  'https://www.airbnb.com/rooms/1665449612509139497',
  'https://www.airbnb.com.py/calendar/ical/1665449612509139497.ics?t=6ac5f65eacba4644a363119b6a5e34c3',
  array[
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/0cab06e8-dc73-4aec-96c6-ba7536127177.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/941b7d7e-e0c0-49fb-97ca-576a0a565096.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/8d1326bd-b0d4-40f8-a487-5c910d5ed502.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/47d65f89-12b7-493d-9962-e5264f495c31.jpeg',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/f5ed7b3b-662f-450d-9ae4-142fd6d9f78f.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/79dbf82c-a612-4816-9361-67144da1e523.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/4bb3b421-21b1-44b4-8786-c189c3f5bc3d.png',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1665449612509139497/original/1cad5796-9a89-4004-88c6-aed345624e34.jpeg'
  ],
  'active',
  'Calle Puschmann, Park Lofts Airport, Piso 2 #201',
  'Asuncion',
  'Central',
  'Paraguay',
  'Aeropuerto',
  (-25.2531271)::numeric(10, 7),
  (-57.5529431)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2531271,-57.5529431'
)

on conflict (airbnb_ical_url) do update set
  name              = excluded.name,
  description       = excluded.description,
  nightly_rate_usd  = excluded.nightly_rate_usd,
  max_guests        = excluded.max_guests,
  bedrooms          = excluded.bedrooms,
  beds              = excluded.beds,
  airbnb_listing_url = excluded.airbnb_listing_url,
  image_urls        = excluded.image_urls,
  status            = excluded.status,
  street_address    = excluded.street_address,
  city              = excluded.city,
  state             = excluded.state,
  country           = excluded.country,
  neighborhood      = excluded.neighborhood,
  latitude          = excluded.latitude,
  longitude         = excluded.longitude,
  google_maps_url   = excluded.google_maps_url,
  updated_at        = now();
