import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api from '../api/axios';
import { StorageService } from '../services/storageService';

interface CreationContextValue {
  listingId: string | null;
  setListingId: React.Dispatch<React.SetStateAction<string | null>>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  updateListingProgress: (payload: Record<string, unknown>) => Promise<unknown>;
  resetCreation: () => Promise<void>;
}

const CreationContext = createContext<CreationContextValue | undefined>(undefined);

export function CreationProvider({ children }: { children: React.ReactNode }) {
  const [listingId, setListingId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateListingProgress = useCallback(async (payload: Record<string, unknown>) => {
    return api.post('/listings/progress', payload);
  }, []);

  const resetCreation = useCallback(async () => {
    setListingId(null);
    setActiveIndex(0);
    setIsSubmitting(false);

    const pendingId = await StorageService.getItem('creation_listing_id');
    const keysToClear = [
      'step 1 host',
      'step 2 host',
      'step 2 title',
      'step 2 photos',
      'step 2 description',
      'step 2 description highlights',
      'step 3 weekday price',
      'step 3 weekend price',
      'step 3 booking settings',
      'step 3 discounts',
      'step 3 safety details',
      'step 3 final detail',
      'step 4 airbnb urls',
      'creation_flow_step',
      'creation_listing_id',
      'step2'
    ];

    for (const key of keysToClear) {
      await StorageService.removeItem(key);
    }

    if (pendingId) {
      await StorageService.removePendingListing(pendingId as string);
    }
  }, []);

  const value = useMemo(
    () => ({
      listingId,
      setListingId,
      activeIndex,
      setActiveIndex,
      isSubmitting,
      setIsSubmitting,
      updateListingProgress,
      resetCreation
    }),
    [
      listingId,
      activeIndex,
      isSubmitting,
      updateListingProgress,
      resetCreation
    ]
  );

  return <CreationContext.Provider value={value}>{children}</CreationContext.Provider>;
}

export function useCreation(): CreationContextValue {
  const context = useContext(CreationContext);
  if (!context) throw new Error('useCreation must be used within CreationProvider');
  return context;
}
