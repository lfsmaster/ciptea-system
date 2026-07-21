export type Role = 'administrator' | 'operator' | 'analyst' | 'approver' | 'issuer' | 'auditor' | 'support';
export type ApplicationStatus = 'draft' | 'incomplete' | 'awaiting_documents' | 'under_review' | 'pending' | 'approved' | 'rejected' | 'awaiting_issuance' | 'issued' | 'printed' | 'delivered' | 'expired' | 'suspended' | 'cancelled' | 'replaced' | 'reissued';

export interface Profile { id: string; full_name: string; email?: string | null; unit_id?: string | null; active: boolean; roles: Role[]; }
export interface Beneficiary {
  id: string; full_name: string; social_name?: string | null; birth_date: string; sex: string; cpf?: string | null; rg?: string | null;
  sus_number: string; phone?: string | null; email?: string | null; zip_code?: string | null; address?: string | null; city: string; state: string;
  cid: string; support_level: string; photo_path?: string | null; created_at: string; updated_at: string;
}
export interface Caregiver { full_name: string; cpf?: string | null; phone: string; email?: string | null; relationship: string; address?: string | null; }
export interface EmergencyInformation { blood_type?: string | null; allergies?: string | null; continuous_medications?: string | null; important_conditions?: string | null; other_information?: string | null; emergency_contact?: string | null; }
export interface Application { id: string; beneficiary_id: string; status: ApplicationStatus; requested_at: string; issued_at?: string | null; expires_at?: string | null; card_number?: string | null; notes?: string | null; beneficiary?: Beneficiary; }
export interface VerificationResult { found: boolean; status?: string; issuer?: string; masked_card_number?: string; masked_name?: string; issued_at?: string; expires_at?: string; public_code?: string; checked_at: string; message?: string; }
