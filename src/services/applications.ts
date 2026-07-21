import { requireSupabase } from '../lib/supabase';
import type { Application } from '../types/domain';
export async function listApplications(){const{data,error}=await requireSupabase().from('applications').select('*, beneficiary:beneficiaries(*)').is('deleted_at',null).order('created_at',{ascending:false}).limit(100);if(error)throw error;return data as Application[];}
export async function createApplication(beneficiaryId:string){const{data,error}=await requireSupabase().from('applications').insert({beneficiary_id:beneficiaryId,status:'draft'}).select().single();if(error)throw error;return data;}
export async function updateApplicationStatus(id:string,status:string,reason?:string){const{data,error}=await requireSupabase().rpc('transition_application_status',{p_application_id:id,p_new_status:status,p_reason:reason||null});if(error)throw error;return data;}
