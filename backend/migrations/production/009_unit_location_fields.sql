-- ============================================================================
-- 009_unit_location_fields.sql
-- Add address and location fields to units so the public API can return the
-- shape expected by the booking widget, and so the detail page can render a
-- map pin plus an "Open in Google Maps" CTA, Airbnb-style.
--
-- All fields are optional to keep legacy rows working. Validation is pushed
-- to the database layer so bad writes can never reach production.
-- ============================================================================

alter table public.units
  add column if not exists street_address  text,
  add column if not exists city            text,
  add column if not exists state           text,
  add column if not exists country         text,
  add column if not exists postal_code     text,
  add column if not exists neighborhood    text,
  add column if not exists latitude        numeric(10, 7),
  add column if not exists longitude       numeric(10, 7),
  add column if not exists google_maps_url text;

-- Text length guards. All are null-tolerant so existing rows stay valid.
alter table public.units
  drop constraint if exists units_neighborhood_length;
alter table public.units
  add constraint units_neighborhood_length
    check (neighborhood is null or char_length(neighborhood) between 2 and 80);

alter table public.units
  drop constraint if exists units_city_length;
alter table public.units
  add constraint units_city_length
    check (city is null or char_length(city) between 2 and 80);

alter table public.units
  drop constraint if exists units_state_length;
alter table public.units
  add constraint units_state_length
    check (state is null or char_length(state) between 2 and 80);

alter table public.units
  drop constraint if exists units_country_length;
alter table public.units
  add constraint units_country_length
    check (country is null or char_length(country) between 2 and 80);

alter table public.units
  drop constraint if exists units_street_address_length;
alter table public.units
  add constraint units_street_address_length
    check (street_address is null or char_length(street_address) between 3 and 200);

-- Coordinate guards. We accept the full Earth range, which also keeps the
-- constraints simple. The UI only renders the map when both values are set.
alter table public.units
  drop constraint if exists units_latitude_range;
alter table public.units
  add constraint units_latitude_range
    check (latitude is null or (latitude between -90 and 90));

alter table public.units
  drop constraint if exists units_longitude_range;
alter table public.units
  add constraint units_longitude_range
    check (longitude is null or (longitude between -180 and 180));

alter table public.units
  drop constraint if exists units_coords_pair;
alter table public.units
  add constraint units_coords_pair
    check (
      (latitude is null and longitude is null)
      or (latitude is not null and longitude is not null)
    );

alter table public.units
  drop constraint if exists units_google_maps_url_format;
alter table public.units
  add constraint units_google_maps_url_format
    check (google_maps_url is null or google_maps_url ~* '^https?://');

comment on column public.units.street_address  is 'Human readable street address including number and landmark.';
comment on column public.units.city             is 'City name, shown on the card and detail header.';
comment on column public.units.state             is 'State or department, shown after the city.';
comment on column public.units.country          is 'Country name, rendered in the detail header meta line.';
comment on column public.units.postal_code      is 'Postal code, currently optional.';
comment on column public.units.neighborhood    is 'Filter chip value shown above the grid and on each card.';
comment on column public.units.latitude         is 'Decimal degrees, -90 to 90. Must be paired with longitude.';
comment on column public.units.longitude        is 'Decimal degrees, -180 to 180. Must be paired with latitude.';
comment on column public.units.google_maps_url  is 'Public Google Maps URL used as the "Open in Google Maps" CTA.';

create index if not exists units_neighborhood_idx
  on public.units (neighborhood)
  where neighborhood is not null;
