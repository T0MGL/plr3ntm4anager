-- ============================================================================
-- 010_seed_unit_locations.sql
-- Backfill neighborhood, street, city, state, country, and coordinates for
-- the three existing Park Lofts canonical units (defined in 008_seed_park_lofts_units.sql)
-- and seed two additional demo units so the map, filter chips, and grid all
-- have enough variety to exercise every branch of the UI.
--
-- All five rows live inside the airbnb_ical_url namespace
-- (ical.placeholder.parkloftsparaguay.com), so they are safe to UPDATE and
-- ON CONFLICT without colliding with real inventory once Park Lofts ops starts
-- wiring actual iCal feeds.
--
-- Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Canonical units, Villa Morra, Park Lofts Tower on Av Santa Teresa.
-- Coordinates are sub-meter jittered per unit so pins on the map do not
-- overlap, without misrepresenting the building.
-- ----------------------------------------------------------------------------

update public.units
set
  street_address  = 'Avenida Santa Teresa 1827, Park Lofts Tower',
  city            = 'Asuncion',
  state           = 'Central',
  country         = 'Paraguay',
  neighborhood    = 'Villa Morra',
  latitude        = (-25.2918)::numeric(10, 7),
  longitude       = (-57.5632)::numeric(10, 7),
  google_maps_url = 'https://www.google.com/maps/search/?api=1&query=-25.2918,-57.5632'
where airbnb_ical_url = 'https://ical.placeholder.parkloftsparaguay.com/calendars/loft-1202.ics';

update public.units
set
  street_address  = 'Avenida Santa Teresa 1827, Park Lofts Tower',
  city            = 'Asuncion',
  state           = 'Central',
  country         = 'Paraguay',
  neighborhood    = 'Villa Morra',
  latitude        = (-25.2919)::numeric(10, 7),
  longitude       = (-57.5631)::numeric(10, 7),
  google_maps_url = 'https://www.google.com/maps/search/?api=1&query=-25.2919,-57.5631'
where airbnb_ical_url = 'https://ical.placeholder.parkloftsparaguay.com/calendars/loft-1505.ics';

update public.units
set
  street_address  = 'Avenida Santa Teresa 1827, Park Lofts Tower',
  city            = 'Asuncion',
  state           = 'Central',
  country         = 'Paraguay',
  neighborhood    = 'Villa Morra',
  latitude        = (-25.2917)::numeric(10, 7),
  longitude       = (-57.5633)::numeric(10, 7),
  google_maps_url = 'https://www.google.com/maps/search/?api=1&query=-25.2917,-57.5633'
where airbnb_ical_url = 'https://ical.placeholder.parkloftsparaguay.com/calendars/penthouse-2301.ics';

-- ----------------------------------------------------------------------------
-- Demo unit, Recoleta, zone that exercises the Recoleta chip.
-- ----------------------------------------------------------------------------

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
) values (
  'Loft Recoleta 702',
  'Studio loft en el corazon de Recoleta, con ventanal al Jardin Botanico, acabados en madera natural y zona de trabajo dedicada. A dos cuadras de restaurantes y cafes de autor.',
  95,
  2,
  0,
  1,
  null,
  'https://ical.placeholder.parkloftsparaguay.com/calendars/demo-recoleta-702.ics',
  array[
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&q=80',
    'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1600&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=80'
  ],
  'active',
  'Avenida Espana 1234',
  'Asuncion',
  'Central',
  'Paraguay',
  'Recoleta',
  (-25.2867)::numeric(10, 7),
  (-57.5775)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2867,-57.5775'
)
on conflict (airbnb_ical_url) do update set
  name            = excluded.name,
  description     = excluded.description,
  nightly_rate_usd = excluded.nightly_rate_usd,
  max_guests      = excluded.max_guests,
  bedrooms        = excluded.bedrooms,
  beds            = excluded.beds,
  image_urls      = excluded.image_urls,
  status          = excluded.status,
  street_address  = excluded.street_address,
  city            = excluded.city,
  state           = excluded.state,
  country         = excluded.country,
  neighborhood    = excluded.neighborhood,
  latitude        = excluded.latitude,
  longitude       = excluded.longitude,
  google_maps_url = excluded.google_maps_url,
  updated_at      = now();

-- ----------------------------------------------------------------------------
-- Demo unit, Las Mercedes, for the Las Mercedes chip.
-- ----------------------------------------------------------------------------

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
) values (
  'Loft Mercedes 301',
  'Loft en Las Mercedes, zona tranquila y caminable a diez minutos del centro de negocios. Cocina completa, bano privado y terraza compartida con piscina.',
  110,
  3,
  1,
  2,
  null,
  'https://ical.placeholder.parkloftsparaguay.com/calendars/demo-mercedes-301.ics',
  array[
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=80',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&q=80'
  ],
  'active',
  'Calle Mcal Lopez 3521',
  'Asuncion',
  'Central',
  'Paraguay',
  'Las Mercedes',
  (-25.2786)::numeric(10, 7),
  (-57.5810)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2786,-57.5810'
)
on conflict (airbnb_ical_url) do update set
  name            = excluded.name,
  description     = excluded.description,
  nightly_rate_usd = excluded.nightly_rate_usd,
  max_guests      = excluded.max_guests,
  bedrooms        = excluded.bedrooms,
  beds            = excluded.beds,
  image_urls      = excluded.image_urls,
  status          = excluded.status,
  street_address  = excluded.street_address,
  city            = excluded.city,
  state           = excluded.state,
  country         = excluded.country,
  neighborhood    = excluded.neighborhood,
  latitude        = excluded.latitude,
  longitude       = excluded.longitude,
  google_maps_url = excluded.google_maps_url,
  updated_at      = now();

-- ----------------------------------------------------------------------------
-- Demo unit, Aeropuerto, near Silvio Pettirossi (DUE).
-- ----------------------------------------------------------------------------

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
) values (
  'Loft Aeropuerto Express',
  'Loft compacto a cinco minutos del aeropuerto Silvio Pettirossi. Ideal para escalas cortas o llegadas tarde: check-in rapido, cama premium y zona de trabajo con fibra simetrica.',
  85,
  2,
  1,
  1,
  null,
  'https://ical.placeholder.parkloftsparaguay.com/calendars/demo-aeropuerto-express.ics',
  array[
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687644-aac76f0e23ec?w=1600&q=80',
    'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1600&q=80'
  ],
  'active',
  'Avenida Aviadores del Chaco 2001',
  'Luque',
  'Central',
  'Paraguay',
  'Aeropuerto',
  (-25.2400)::numeric(10, 7),
  (-57.5199)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2400,-57.5199'
)
on conflict (airbnb_ical_url) do update set
  name            = excluded.name,
  description     = excluded.description,
  nightly_rate_usd = excluded.nightly_rate_usd,
  max_guests      = excluded.max_guests,
  bedrooms        = excluded.bedrooms,
  beds            = excluded.beds,
  image_urls      = excluded.image_urls,
  status          = excluded.status,
  street_address  = excluded.street_address,
  city            = excluded.city,
  state           = excluded.state,
  country         = excluded.country,
  neighborhood    = excluded.neighborhood,
  latitude        = excluded.latitude,
  longitude       = excluded.longitude,
  google_maps_url = excluded.google_maps_url,
  updated_at      = now();

-- ----------------------------------------------------------------------------
-- Demo unit, Centro, historic Asuncion.
-- ----------------------------------------------------------------------------

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
) values (
  'Loft Centro Historico',
  'Loft en pleno centro historico, a una cuadra del Palacio de Lopez y la Costanera. Balcon francesito, piso de madera original y luz de la manana sobre la bahia.',
  130,
  3,
  1,
  2,
  null,
  'https://ical.placeholder.parkloftsparaguay.com/calendars/demo-centro-historico.ics',
  array[
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80'
  ],
  'active',
  'Calle Palma 485',
  'Asuncion',
  'Central',
  'Paraguay',
  'Centro',
  (-25.2822)::numeric(10, 7),
  (-57.6354)::numeric(10, 7),
  'https://www.google.com/maps/search/?api=1&query=-25.2822,-57.6354'
)
on conflict (airbnb_ical_url) do update set
  name            = excluded.name,
  description     = excluded.description,
  nightly_rate_usd = excluded.nightly_rate_usd,
  max_guests      = excluded.max_guests,
  bedrooms        = excluded.bedrooms,
  beds            = excluded.beds,
  image_urls      = excluded.image_urls,
  status          = excluded.status,
  street_address  = excluded.street_address,
  city            = excluded.city,
  state           = excluded.state,
  country         = excluded.country,
  neighborhood    = excluded.neighborhood,
  latitude        = excluded.latitude,
  longitude       = excluded.longitude,
  google_maps_url = excluded.google_maps_url,
  updated_at      = now();
