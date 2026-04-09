-- ============================================================================
-- 008_seed_park_lofts_units.sql
-- Park Lofts Paraguay rentable units seed.
--
-- Three curated lofts within Park Lofts Tower, Asuncion.
-- Placeholder image URLs use Unsplash collections (neutral, architectural).
-- airbnb_ical_url values are staging placeholders, unique per unit.
--
-- Idempotent: uses ON CONFLICT DO UPDATE so re-running updates the canonical
-- rows without duplication.
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
  status
) values
(
  'Loft Mariscal 1202',
  'Loft de autor con doble altura en el piso 12 de Park Lofts Tower. Vista panoramica al skyline de Asuncion, cocina integrada, iluminacion calida y detalles en madera natural. Pensado para estancias cortas de alto estandar.',
  120,
  2,
  1,
  1,
  'https://www.airbnb.com/rooms/park-lofts-1202',
  'https://ical.placeholder.parkloftsparaguay.com/calendars/loft-1202.ics',
  array[
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1600&q=80'
  ],
  'active'
),
(
  'Loft Recoleta 1505',
  'Suite loft en el piso 15 con ventanal de piso a techo y un dormitorio principal con bano privado. Acabados serenos, paleta clara y zona de estar con escritorio. Ideal para viajeros de negocios o escapadas en pareja.',
  145,
  2,
  1,
  1,
  'https://www.airbnb.com/rooms/park-lofts-1505',
  'https://ical.placeholder.parkloftsparaguay.com/calendars/loft-1505.ics',
  array[
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=80',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=80',
    'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=1600&q=80',
    'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=1600&q=80'
  ],
  'active'
),
(
  'Penthouse Skyline 2301',
  'Penthouse con terraza privada y vista integral al Jardin Botanico. Dos dormitorios, cocina de autor, living espacioso y zona de yoga al aire libre. La experiencia mas alta de Park Lofts.',
  285,
  4,
  2,
  3,
  'https://www.airbnb.com/rooms/park-lofts-2301',
  'https://ical.placeholder.parkloftsparaguay.com/calendars/penthouse-2301.ics',
  array[
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&q=80',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1600&q=80',
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1600&q=80',
    'https://images.unsplash.com/photo-1600566753086-00f18fe6ba68?w=1600&q=80'
  ],
  'active'
)
on conflict (airbnb_ical_url) do update set
  name = excluded.name,
  description = excluded.description,
  nightly_rate_usd = excluded.nightly_rate_usd,
  max_guests = excluded.max_guests,
  bedrooms = excluded.bedrooms,
  beds = excluded.beds,
  airbnb_listing_url = excluded.airbnb_listing_url,
  image_urls = excluded.image_urls,
  status = excluded.status,
  updated_at = now();
