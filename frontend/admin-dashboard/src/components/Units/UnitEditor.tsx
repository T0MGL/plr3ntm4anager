import { useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { FiX, FiUpload, FiTrash2, FiMove } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { api } from '../../utils/api';
import type { UnitRow } from './UnitList';

interface UnitEditorProps {
  unit: UnitRow;
  onClose: (shouldRefresh?: boolean) => void;
}

interface PhotoItem {
  id: string;
  url: string;
  isNew: boolean;
  file?: File;
}

const MIN_PHOTOS = 5;

export default function UnitEditor({ unit, onClose }: UnitEditorProps) {
  const [name, setName] = useState(unit.name);
  const [description, setDescription] = useState(unit.description ?? '');
  const [nightlyRate, setNightlyRate] = useState<number>(unit.nightly_rate_usd);
  const [maxGuests, setMaxGuests] = useState<number>(unit.max_guests);
  const [bedrooms, setBedrooms] = useState<number>(
    Number(unit.bedrooms ?? unit.bedroom_count ?? 1),
  );
  const [beds, setBeds] = useState<number>(Number(unit.beds ?? unit.bed_count ?? 1));
  const [status, setStatus] = useState<string>(unit.status || 'active');
  const [airbnbListingUrl, setAirbnbListingUrl] = useState(unit.airbnb_listing_url ?? '');
  const [airbnbIcalUrl, setAirbnbIcalUrl] = useState(unit.airbnb_ical_url ?? '');
  const [streetAddress, setStreetAddress] = useState(unit.street_address ?? '');
  const [neighborhood, setNeighborhood] = useState(unit.neighborhood ?? '');
  const [city, setCity] = useState(unit.city ?? '');
  const [stateRegion, setStateRegion] = useState(unit.state ?? '');
  const [country, setCountry] = useState(unit.country ?? '');
  const [latitude, setLatitude] = useState<string>(
    unit.latitude != null ? String(unit.latitude) : '',
  );
  const [longitude, setLongitude] = useState<string>(
    unit.longitude != null ? String(unit.longitude) : '',
  );
  const [googleMapsUrl, setGoogleMapsUrl] = useState(unit.google_maps_url ?? '');
  const [photos, setPhotos] = useState<PhotoItem[]>(
    (unit.image_urls ?? []).map((url, idx) => ({
      id: `existing-${idx}-${url}`,
      url,
      isNew: false,
    })),
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p.isNew && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, []);

  const handleAddPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newItems: PhotoItem[] = files.map((file) => ({
      id: `new-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      url: URL.createObjectURL(file),
      isNew: true,
      file,
    }));
    setPhotos((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => {
      const toRemove = prev.find((p) => p.id === id);
      if (toRemove?.isNew && toRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(toRemove.url);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIdx !== idx) setOverIdx(idx);
  };

  const handleDragLeave = () => {
    setOverIdx(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    const from = dragIdx;
    setDragIdx(null);
    setOverIdx(null);
    if (from === null || from === idx) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(idx, 0, item);
      return next;
    });
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (photos.length < MIN_PHOTOS) {
      toast.error(`Se requieren al menos ${MIN_PHOTOS} fotos`);
      return;
    }
    if (!airbnbIcalUrl.trim()) {
      toast.error('URL iCal de Airbnb es obligatoria');
      return;
    }
    if (!Number.isFinite(nightlyRate) || nightlyRate <= 0) {
      toast.error('El precio por noche debe ser mayor a 0');
      return;
    }

    setIsSaving(true);
    const uploadToastId = 'unit-editor-upload';

    try {
      const finalUrls: string[] = [];
      const newPhotoCount = photos.filter((p) => p.isNew).length;
      let uploadedSoFar = 0;

      for (const p of photos) {
        if (p.isNew && p.file) {
          uploadedSoFar += 1;
          toast.loading(`Subiendo foto ${uploadedSoFar}/${newPhotoCount}...`, {
            id: uploadToastId,
          });
          const fd = new FormData();
          fd.append('photos', p.file);
          const res = await api.post<{ data: { publicId: string; secureUrl: string }[] }>(
            '/admin/units/photos/upload',
            fd,
          );
          const uploaded = res.data?.data?.[0];
          if (uploaded?.secureUrl) {
            finalUrls.push(uploaded.secureUrl);
          } else {
            throw new Error('Upload response missing URL');
          }
        } else {
          finalUrls.push(p.url);
        }
      }

      if (newPhotoCount > 0) {
        toast.success('Fotos subidas', { id: uploadToastId });
      }

      if (finalUrls.length < MIN_PHOTOS) {
        toast.error('No se cargaron suficientes fotos');
        setIsSaving(false);
        return;
      }

      const lat = latitude.trim() ? Number(latitude) : null;
      const lng = longitude.trim() ? Number(longitude) : null;
      if (lat !== null && !Number.isFinite(lat)) {
        toast.error('Latitud invalida');
        setIsSaving(false);
        return;
      }
      if (lng !== null && !Number.isFinite(lng)) {
        toast.error('Longitud invalida');
        setIsSaving(false);
        return;
      }

      await api.put(`/admin/units/${unit.id}`, {
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        nightly_rate_usd: Number(nightlyRate),
        max_guests: Math.max(1, Number(maxGuests) || 1),
        bedrooms: Number(bedrooms) > 0 ? Number(bedrooms) : undefined,
        beds: Number(beds) > 0 ? Number(beds) : undefined,
        airbnb_listing_url: airbnbListingUrl.trim() || undefined,
        airbnb_ical_url: airbnbIcalUrl.trim(),
        image_urls: finalUrls,
        status: status === 'inactive' ? 'inactive' : 'active',
        street_address: streetAddress.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: stateRegion.trim() || null,
        country: country.trim() || null,
        latitude: lat,
        longitude: lng,
        google_maps_url: googleMapsUrl.trim() || null,
      });

      toast.success('Unidad actualizada');
      onClose(true);
    } catch (err: unknown) {
      console.error('Failed to update unit:', err);
      const anyErr = err as { response?: { data?: { error?: unknown } }; message?: string };
      const backendErr = anyErr?.response?.data?.error;
      const msg =
        typeof backendErr === 'string'
          ? backendErr
          : Array.isArray(backendErr)
            ? backendErr.join(', ')
            : anyErr?.message || 'Error al actualizar';
      toast.error(msg, { id: uploadToastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-4"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[#ebebeb] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ebebeb] px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b7280]">
              Editar unidad
            </p>
            <h2 className="truncate text-xl font-semibold text-[#111827]">{unit.name}</h2>
          </div>
          <button
            type="button"
            onClick={() => !isSaving && onClose()}
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100"
            aria-label="Cerrar"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#222]">Fotos</h3>
                <p className="text-xs text-[#6a6a6a]">
                  Arrastra para reordenar. La primera es la portada. Minimo {MIN_PHOTOS}.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#dddddd] bg-white px-3 py-2 text-xs font-semibold text-[#484848] transition-colors hover:bg-[#f7f7f7]">
                <FiUpload className="h-3.5 w-3.5" />
                Agregar
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleAddPhotos}
                />
              </label>
            </div>

            {photos.length === 0 ? (
              <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-[#fafafa] text-center text-sm text-[#6a6a6a] hover:border-[#1e3a8a] hover:bg-white">
                <FiUpload className="h-5 w-5" />
                Click para agregar fotos
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleAddPhotos}
                />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 bg-gray-50 transition-all active:cursor-grabbing ${
                      dragIdx === idx
                        ? 'scale-95 opacity-40 border-[#1e3a8a]'
                        : overIdx === idx && dragIdx !== null
                          ? 'border-[#1e3a8a] ring-2 ring-[#1e3a8a]/30'
                          : idx === 0
                            ? 'border-[#1e3a8a]/60'
                            : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={`Foto ${idx + 1}`}
                      className="pointer-events-none h-full w-full object-cover"
                      draggable={false}
                    />
                    <div className="pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#484848] shadow-sm">
                      <FiMove className="h-3 w-3" />
                    </div>
                    {idx === 0 && (
                      <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-[#1e3a8a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Portada
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#c1355b] shadow-sm opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                      aria-label="Eliminar foto"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p
              className={`mt-2 text-xs ${photos.length >= MIN_PHOTOS ? 'text-emerald-600' : 'text-[#c1355b]'}`}
            >
              {photos.length} foto{photos.length === 1 ? '' : 's'} cargada
              {photos.length === 1 ? '' : 's'}
              {photos.length < MIN_PHOTOS ? ` (faltan ${MIN_PHOTOS - photos.length})` : ''}
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold text-[#222]">Informacion</h3>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Descripcion
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Precio/noche USD
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={Number.isFinite(nightlyRate) ? nightlyRate : ''}
                  onChange={(e) => setNightlyRate(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Huespedes
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Dormitorios
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Camas
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={beds}
                  onChange={(e) => setBeds(Number(e.target.value))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              >
                <option value="active">Activa</option>
                <option value="inactive">Inactiva</option>
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[#222]">Ubicacion</h3>
              <p className="text-xs text-[#6a6a6a]">
                Se muestra en el widget y se usa como base para el link de Google Maps.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Direccion
              </label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="Calle y numero"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Barrio (opcional)
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Ciudad
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Departamento / Estado
                </label>
                <input
                  type="text"
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Pais
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Latitud (opcional, para mapa)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="-25.2637"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  Longitud (opcional, para mapa)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-57.5759"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Link de Google Maps (opcional)
              </label>
              <input
                type="url"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/?q=..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#9ca3af]">
                Si lo dejas vacio, el widget lo arma automaticamente con las coordenadas.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-base font-semibold text-[#222]">Sincronizacion Airbnb</h3>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                URL del listing (opcional)
              </label>
              <input
                type="url"
                value={airbnbListingUrl}
                onChange={(e) => setAirbnbListingUrl(e.target.value)}
                placeholder="https://www.airbnb.com/rooms/..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                URL iCal (obligatorio)
              </label>
              <input
                type="url"
                value={airbnbIcalUrl}
                onChange={(e) => setAirbnbIcalUrl(e.target.value)}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#222] shadow-sm focus:border-[#1e3a8a] focus:outline-none"
              />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#ebebeb] bg-[#fafafa] px-6 py-4">
          <button
            type="button"
            onClick={() => !isSaving && onClose()}
            disabled={isSaving}
            className="rounded-full border border-[#dddddd] bg-white px-5 py-2.5 text-sm font-medium text-[#484848] transition-colors hover:bg-[#f7f7f7] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-full bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#172d69] disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
