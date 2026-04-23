alter table public.units
  add column if not exists bathrooms smallint
    check (bathrooms is null or bathrooms between 0 and 20);

comment on column public.units.bathrooms is 'Total number of bathrooms (private + dedicated + shared). Null means not set.';
