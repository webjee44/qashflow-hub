// ============================================
// Personnel Service
// Pure data layer - no UI side effects
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getGlobalChargesRate } from '@/lib/french-rates';

export type WorkerType = 'employee' | 'freelance' | 'intern';

export interface BPPersonnel {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  position: string;
  gross_salary: number;
  employer_charges_rate: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  contract_type: string;
  is_executive: boolean;
  company_size: string;
  worker_type: WorkerType;
  daily_rate: number | null;
  estimated_days_per_month: number | null;
  created_at: string;
  updated_at: string;
}

export const WORKER_TYPES = {
  employee: { label: 'Salarié', icon: 'User' },
  freelance: { label: 'Freelance / Prestataire', icon: 'Briefcase' },
  intern: { label: 'Stagiaire', icon: 'GraduationCap' },
};

export const CONTRACT_TYPES = {
  cdi: { label: 'CDI', workerType: 'employee' },
  cdd: { label: 'CDD', workerType: 'employee' },
  apprentissage: { label: 'Apprentissage', workerType: 'employee' },
  stage: { label: 'Stage', workerType: 'intern' },
  freelance: { label: 'Freelance / Prestation', workerType: 'freelance' },
};

export type BPPersonnelInsert = Partial<Omit<BPPersonnel, 'id' | 'created_at' | 'updated_at'>>;
export type BPPersonnelUpdate = Partial<Omit<BPPersonnel, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const personnelService = {
  async getByBusinessPlanId(businessPlanId: string): Promise<BPPersonnel[]> {
    const { data, error } = await supabase
      .from('bp_personnel')
      .select('*')
      .eq('business_plan_id', businessPlanId)
      .order('position', { ascending: true });

    if (error) throw error;
    return (data || []) as BPPersonnel[];
  },

  async create(userId: string, businessPlanId: string, data: BPPersonnelInsert): Promise<BPPersonnel> {
    const workerType = data.worker_type || 'employee';
    const isFreelance = workerType === 'freelance';
    
    let chargesRate = 0;
    if (!isFreelance) {
      const grossSalary = data.gross_salary || 0;
      const isExecutive = data.is_executive ?? false;
      const companySize = (data.company_size || 'small') as 'small' | 'medium' | 'large';
      const contractType = data.contract_type || 'cdi';
      chargesRate = getGlobalChargesRate(grossSalary, isExecutive, companySize, contractType);
    }

    const { data: newPerson, error } = await supabase
      .from('bp_personnel')
      .insert({
        user_id: userId,
        business_plan_id: businessPlanId,
        position: data.position || 'Nouveau poste',
        gross_salary: isFreelance ? 0 : (data.gross_salary || 0),
        employer_charges_rate: chargesRate,
        start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
        end_date: data.end_date || null,
        notes: data.notes || null,
        contract_type: data.contract_type || (isFreelance ? 'freelance' : 'cdi'),
        is_executive: data.is_executive ?? false,
        company_size: data.company_size || 'small',
        worker_type: workerType,
        daily_rate: isFreelance ? (data.daily_rate || 0) : null,
        estimated_days_per_month: isFreelance ? (data.estimated_days_per_month || 0) : null,
      })
      .select()
      .single();

    if (error) throw error;
    return newPerson as BPPersonnel;
  },

  async update(id: string, data: BPPersonnelUpdate, existingPersonnel?: BPPersonnel[]): Promise<void> {
    let updateData = { ...data };
    
    if (data.worker_type === 'freelance') {
      updateData.employer_charges_rate = 0;
      updateData.gross_salary = 0;
    } else if (existingPersonnel && (
      data.gross_salary !== undefined || 
      data.is_executive !== undefined || 
      data.company_size !== undefined || 
      data.contract_type !== undefined
    )) {
      const existing = existingPersonnel.find(p => p.id === id);
      if (existing) {
        const grossSalary = data.gross_salary ?? existing.gross_salary;
        const isExecutive = data.is_executive ?? existing.is_executive;
        const companySize = (data.company_size || existing.company_size || 'small') as 'small' | 'medium' | 'large';
        const contractType = data.contract_type || existing.contract_type || 'cdi';
        updateData.employer_charges_rate = getGlobalChargesRate(grossSalary, isExecutive, companySize, contractType);
      }
    }

    const { error } = await supabase
      .from('bp_personnel')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_personnel')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Utility methods
  getEmployeeMonthlyCost(person: BPPersonnel): number {
    const salary = Number(person.gross_salary);
    const charges = salary * Number(person.employer_charges_rate);
    return salary + charges;
  },

  getFreelanceMonthlyCost(person: BPPersonnel): number {
    const dailyRate = Number(person.daily_rate) || 0;
    const daysPerMonth = Number(person.estimated_days_per_month) || 0;
    return dailyRate * daysPerMonth;
  },

  getMonthlyCost(person: BPPersonnel): number {
    if (person.worker_type === 'freelance') {
      return this.getFreelanceMonthlyCost(person);
    }
    return this.getEmployeeMonthlyCost(person);
  },

  separateByType(personnel: BPPersonnel[]): { employees: BPPersonnel[]; freelancers: BPPersonnel[] } {
    return {
      employees: personnel.filter(p => p.worker_type === 'employee' || p.worker_type === 'intern'),
      freelancers: personnel.filter(p => p.worker_type === 'freelance'),
    };
  },
};
