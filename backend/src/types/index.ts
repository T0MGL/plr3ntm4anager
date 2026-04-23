export enum UnitStatus {
  Active = 'active',
  Inactive = 'inactive'
}

export enum BookingStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Paid = 'paid',
  Cancelled = 'cancelled'
}

export enum PaymentStatus {
  Pending = 'pending',
  Preauthorized = 'preauthorized',
  Completed = 'completed',
  Failed = 'failed',
  Refunded = 'refunded'
}

export enum SyncStatus {
  Success = 'success',
  Failed = 'failed',
  InProgress = 'in_progress'
}

export interface Unit {
  id: string;
  name: string;
  description: string | null;
  nightly_rate_usd: number;
  max_guests: number;
  airbnb_listing_url: string | null;
  airbnb_ical_url: string;
  image_urls: string[] | null;
  status: UnitStatus;
  created_at: string;
  updated_at: string;
}

export interface BookingRequest {
  id: string;
  unit_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  total_price_usd: number;
  special_requests: string | null;
  status: BookingStatus;
  last_sync_at_submission: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRow {
  id: string;
  auth_id: string | null;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  authId: string | null;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  booking_id: string;
  amount_usd: number;
  amount_pyg: number | null;
  shop_process_id: string | null;
  bancard_process_id: string | null;
  bancard_transaction_id: string | null;
  payment_status: PaymentStatus;
  payment_method: string | null;
  is_preauthorization: boolean;
  bancard_response: Record<string, unknown> | null;
  authorization_number: string | null;
  response_code: string | null;
  initiated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}
