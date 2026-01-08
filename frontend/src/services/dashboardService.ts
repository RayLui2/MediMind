import axios from 'axios';

const API_URL = 'http://localhost:8000/dashboard';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// ============ Types ============
export interface HealthProfile {
  id: number;
  user_id: number;
  current_weight?: number;
  height?: number;
  blood_type?: string;
  current_conditions: string[];
  allergies: string[];
  family_history: string[];
  created_at: string;
  updated_at?: string;
}

export interface Medication {
  id: number;
  user_id: number;
  name: string;
  frequency: string;
  time?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface MedicationLog {
  id: number;
  medication_id: number;
  user_id: number;
  taken_at: string;
}

export interface Symptom {
  id: number;
  user_id: number;
  symptom_type: string;
  severity: number;
  notes?: string;
  created_at: string;
}

export interface VitalSign {
  id: number;
  user_id: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  weight?: number;
  temperature?: number;
  notes?: string;
  recorded_at: string;
}

export interface DashboardSummary {
  medications_today: number;
  total_medications: number;
  latest_bp?: string;
  latest_weight?: number;
  symptom_count_today: number;
  active_streak_days: number;
}

// ============ Health Profile API ============
export const getHealthProfile = async (): Promise<HealthProfile> => {
  const response = await axios.get(`${API_URL}/health-profile`, getAuthHeaders());
  return response.data;
};

export const createHealthProfile = async (data: Partial<HealthProfile>): Promise<HealthProfile> => {
  const response = await axios.post(`${API_URL}/health-profile`, data, getAuthHeaders());
  return response.data;
};

export const updateHealthProfile = async (data: Partial<HealthProfile>): Promise<HealthProfile> => {
  const response = await axios.put(`${API_URL}/health-profile`, data, getAuthHeaders());
  return response.data;
};

// ============ Medication API ============
export const getMedications = async (activeOnly: boolean = true): Promise<Medication[]> => {
  const response = await axios.get(`${API_URL}/medications?active_only=${activeOnly}`, getAuthHeaders());
  return response.data;
};

export const createMedication = async (data: {
  name: string;
  frequency: string;
  time?: string;
  notes?: string;
}): Promise<Medication> => {
  const response = await axios.post(`${API_URL}/medications`, data, getAuthHeaders());
  return response.data;
};

export const updateMedication = async (
  medicationId: number,
  data: Partial<Medication>
): Promise<Medication> => {
  const response = await axios.put(`${API_URL}/medications/${medicationId}`, data, getAuthHeaders());
  return response.data;
};

export const deleteMedication = async (medicationId: number): Promise<void> => {
  await axios.delete(`${API_URL}/medications/${medicationId}`, getAuthHeaders());
};

export const logMedicationTaken = async (medicationId: number): Promise<MedicationLog> => {
  const response = await axios.post(`${API_URL}/medications/${medicationId}/log`, {}, getAuthHeaders());
  return response.data;
};

export const getMedicationLogs = async (medicationId: number, days: number = 7): Promise<MedicationLog[]> => {
  const response = await axios.get(
    `${API_URL}/medications/${medicationId}/logs?days=${days}`,
    getAuthHeaders()
  );
  return response.data;
};

export const getTodaysMedicationLogs = async (): Promise<number[]> => {
  const response = await axios.get(`${API_URL}/medications/logs/today`, getAuthHeaders());
  return response.data;
};

// ============ Symptom API ============
export const getSymptoms = async (days: number = 30): Promise<Symptom[]> => {
  const response = await axios.get(`${API_URL}/symptoms?days=${days}`, getAuthHeaders());
  return response.data;
};

export const createSymptom = async (data: {
  symptom_type: string;
  severity: number;
  notes?: string;
}): Promise<Symptom> => {
  const response = await axios.post(`${API_URL}/symptoms`, data, getAuthHeaders());
  return response.data;
};

export const deleteSymptom = async (symptomId: number): Promise<void> => {
  await axios.delete(`${API_URL}/symptoms/${symptomId}`, getAuthHeaders());
};

// ============ Vital Signs API ============
export const getVitalSigns = async (days: number = 30): Promise<VitalSign[]> => {
  const response = await axios.get(`${API_URL}/vital-signs?days=${days}`, getAuthHeaders());
  return response.data;
};

export const createVitalSign = async (data: {
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  weight?: number;
  temperature?: number;
  notes?: string;
}): Promise<VitalSign> => {
  const response = await axios.post(`${API_URL}/vital-signs`, data, getAuthHeaders());
  return response.data;
};

export const deleteVitalSign = async (vitalId: number): Promise<void> => {
  await axios.delete(`${API_URL}/vital-signs/${vitalId}`, getAuthHeaders());
};

// ============ Dashboard Summary API ============
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const response = await axios.get(`${API_URL}/summary`, getAuthHeaders());
  return response.data;
};
