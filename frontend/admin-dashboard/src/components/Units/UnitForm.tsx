import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const unitSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  nightly_rate_usd: z.number().positive(),
  max_guests: z.number().int().positive(),
  airbnb_listing_url: z.string().url().optional(),
  airbnb_ical_url: z.string().url(),
  image_urls: z.string().optional(),
  status: z.enum(['active', 'inactive'])
});

export type UnitFormValues = z.infer<typeof unitSchema>;

interface UnitFormProps {
  initial?: Partial<UnitFormValues>;
  onSave: (values: UnitFormValues) => Promise<void>;
}

export default function UnitForm({ initial, onSave }: UnitFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      nightly_rate_usd: initial?.nightly_rate_usd ?? 25,
      max_guests: initial?.max_guests ?? 2,
      airbnb_listing_url: initial?.airbnb_listing_url ?? '',
      airbnb_ical_url: initial?.airbnb_ical_url ?? '',
      image_urls: initial?.image_urls ?? '',
      status: initial?.status ?? 'active'
    }
  });

  const submit = async (values: UnitFormValues) => {
    await onSave(values);
  };

  return (
    <form className="grid gap-3" onSubmit={handleSubmit(submit)}>
      <input {...register('name')} className="rounded-lg border p-2" placeholder="Unit name" />
      {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
      <textarea {...register('description')} className="rounded-lg border p-2" placeholder="Description" />
      <input
        {...register('nightly_rate_usd', { valueAsNumber: true })}
        type="number"
        className="rounded-lg border p-2"
        placeholder="Nightly rate"
      />
      <input
        {...register('max_guests', { valueAsNumber: true })}
        type="number"
        className="rounded-lg border p-2"
        placeholder="Max guests"
      />
      <input {...register('airbnb_listing_url')} className="rounded-lg border p-2" placeholder="Airbnb listing URL" />
      <input {...register('airbnb_ical_url')} className="rounded-lg border p-2" placeholder="Airbnb iCal URL" />
      <input {...register('image_urls')} className="rounded-lg border p-2" placeholder="Image URLs (comma-separated)" />
      <select {...register('status')} className="rounded-lg border p-2">
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <button className="rounded-lg bg-ocean text-white py-2" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save unit'}
      </button>
    </form>
  );
}
