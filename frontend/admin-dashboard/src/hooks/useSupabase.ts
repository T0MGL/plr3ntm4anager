import { supabase } from '../context/AuthContext';

export function useSupabase() {
  return supabase;
}
