import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Chart, registerables } from 'chart.js';
import '../styles/Dashboard.css';
import * as dashboardService from '../services/dashboardService';
import { filterSymptoms } from '../data/symptoms';
import WaterIntakeModal from '../components/WaterIntakeModal';

Chart.register(...registerables);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Data states
  const [summary, setSummary] = useState<dashboardService.DashboardSummary | null>(null);
  const [medications, setMedications] = useState<dashboardService.Medication[]>([]);
  const [symptoms, setSymptoms] = useState<dashboardService.Symptom[]>([]);
  const [vitalSigns, setVitalSigns] = useState<dashboardService.VitalSign[]>([]);
  const [healthProfile, setHealthProfile] = useState<dashboardService.HealthProfile | null>(null);
  const [medicationsTakenToday, setMedicationsTakenToday] = useState<Map<string, number>>(new Map());

  // Edit states
  const [editingMedication, setEditingMedication] = useState<dashboardService.Medication | null>(null);
  const [editingSymptom, setEditingSymptom] = useState<dashboardService.Symptom | null>(null);
  const [expandedSymptomNotes, setExpandedSymptomNotes] = useState<Set<number>>(new Set());
  const [expandedMedicationNotes, setExpandedMedicationNotes] = useState<Set<number>>(new Set());

  // Modal states
  const [symptomModalOpen, setSymptomModalOpen] = useState(false);
  const [medicationModalOpen, setMedicationModalOpen] = useState(false);
  const [vitalSignModalOpen, setVitalSignModalOpen] = useState(false);
  const [healthProfileModalOpen, setHealthProfileModalOpen] = useState(false);
  const [waterIntakeModalOpen, setWaterIntakeModalOpen] = useState(false);

  // Form states for symptom modal
  const [symptomType, setSymptomType] = useState('');
  const [severityValue, setSeverityValue] = useState(5);
  const [symptomNotes, setSymptomNotes] = useState('');
  const [symptomSuggestions, setSymptomSuggestions] = useState<string[]>([]);
  const [showSymptomSuggestions, setShowSymptomSuggestions] = useState(false);

  // Form states for medication modal
  const [medicationName, setMedicationName] = useState('');
  const [medicationFrequency, setMedicationFrequency] = useState('');
  const [medicationTime, setMedicationTime] = useState('');
  const [medicationNotes, setMedicationNotes] = useState('');
  const [medicationSuggestions, setMedicationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form states for vital sign modal
  const [systolicBP, setSystolicBP] = useState('');
  const [diastolicBP, setDiastolicBP] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [weight, setWeight] = useState('');

  // Form states for health profile modal
  const [profileWeight, setProfileWeight] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileActivityLevel, setProfileActivityLevel] = useState('sedentary');
  const [profileConditions, setProfileConditions] = useState('');
  const [profileAllergies, setProfileAllergies] = useState('');
  const [profileFamilyHistory, setProfileFamilyHistory] = useState('');

  // Form states for BMR calculator modal
  const [bmrModalOpen, setBmrModalOpen] = useState(false);
  const [bmrGender, setBmrGender] = useState<'male' | 'female' | ''>('');
  const [bmrWeight, setBmrWeight] = useState('');
  const [bmrHeightFeet, setBmrHeightFeet] = useState('');
  const [bmrHeightInches, setBmrHeightInches] = useState('');
  const [bmrAge, setBmrAge] = useState('');
  const [bmrResult, setBmrResult] = useState<number | null>(null);

  // Form states for BMI calculator modal
  const [bmiModalOpen, setBmiModalOpen] = useState(false);
  const [bmiWeight, setBmiWeight] = useState('');
  const [bmiHeightFeet, setBmiHeightFeet] = useState('');
  const [bmiHeightInches, setBmiHeightInches] = useState('');
  const [bmiResult, setBmiResult] = useState<number | null>(null);

  // Form states for Health Risk calculator modal
  const [healthRiskModalOpen, setHealthRiskModalOpen] = useState(false);
  const [healthRiskResult, setHealthRiskResult] = useState<{
    score: number;
    category: string;
    color: string;
    breakdown: { factor: string; score: number; maxScore: number }[];
  } | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Check if user has completed setup, redirect to /setup if not
  useEffect(() => {
    if (user && !user.setup_completed_at) {
      navigate('/setup', { replace: true });
    }
  }, [user, navigate]);

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryData, medsData, symptomsData, vitalsData, takenToday] = await Promise.all([
        dashboardService.getDashboardSummary(),
        dashboardService.getMedications(),
        dashboardService.getSymptoms(30),
        dashboardService.getVitalSigns(7),
        dashboardService.getTodaysMedicationLogs(),
      ]);

      setSummary(summaryData);
      setMedications(medsData);
      setSymptoms(symptomsData);
      setVitalSigns(vitalsData);

      // Populate medication logs map
      const logMap = new Map<string, number>();
      takenToday.forEach(log => {
        const key = `${log.medication_id}-${log.dose_number}`;
        logMap.set(key, log.log_id);
      });
      setMedicationsTakenToday(logMap);

      // Try to fetch health profile
      try {
        const profileData = await dashboardService.getHealthProfile();
        setHealthProfile(profileData);
      } catch (error: any) {
        if (error.response?.status === 404) {
          // No health profile yet - that's okay
          setHealthProfile(null);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Initialize Chart with real data
  useEffect(() => {
    if (!loading && chartRef.current && vitalSigns.length > 0) {
      // Small delay to ensure canvas is fully mounted
      const timeout = setTimeout(() => {
        if (!chartRef.current) return;

        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
          }

          // Get last 7 vital signs
          const last7Vitals = vitalSigns.slice(0, 7).reverse();
          const labels = last7Vitals.map((v) => {
            const date = new Date(v.recorded_at);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
          });
          const systolicData = last7Vitals.map((v) => v.systolic_bp || null);
          const heartRateData = last7Vitals.map((v) => v.heart_rate || null);

          chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Systolic BP',
                  data: systolicData,
                  borderColor: '#2E5EAA',
                  backgroundColor: 'rgba(46, 94, 170, 0.1)',
                  tension: 0.4,
                  fill: true,
                },
                {
                  label: 'Heart Rate',
                  data: heartRateData,
                  borderColor: '#5DD3C6',
                  backgroundColor: 'rgba(93, 211, 198, 0.1)',
                  tension: 0.4,
                  fill: true,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                },
              },
              scales: {
                y: {
                  beginAtZero: false,
                },
              },
            },
          });
        }
      }, 100);

      return () => {
        clearTimeout(timeout);
      };
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [vitalSigns, loading]);

  // Handle symptom type input change with autocomplete
  const handleSymptomTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSymptomType(value);

    // Filter symptoms based on input
    const filtered = filterSymptoms(value);
    setSymptomSuggestions(filtered);
    setShowSymptomSuggestions(filtered.length > 0);
  };

  // Handle selecting a symptom from suggestions
  const handleSelectSymptom = (symptom: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSymptomType(symptom);
    setShowSymptomSuggestions(false);
    setSymptomSuggestions([]);
  };

  // Close symptom suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.symptom-suggestions')) {
        return;
      }
      if (showSymptomSuggestions) {
        setShowSymptomSuggestions(false);
      }
    };

    if (showSymptomSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSymptomSuggestions]);

  // Handle adding symptom
  const handleAddSymptom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSymptom) {
        // Update existing symptom
        const updated = await dashboardService.updateSymptom(editingSymptom.id, {
          symptom_type: symptomType,
          severity: severityValue,
          notes: symptomNotes || undefined,
        });
        setSymptoms(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        // Create new symptom
        const newSymptom = await dashboardService.createSymptom({
          symptom_type: symptomType,
          severity: severityValue,
          notes: symptomNotes || undefined,
        });
        setSymptoms(prev => [newSymptom, ...prev]);
        const newSummary = await dashboardService.getDashboardSummary();
        setSummary(newSummary);
      }

      setSymptomModalOpen(false);
      setEditingSymptom(null);
      setSymptomType('');
      setSeverityValue(5);
      setSymptomNotes('');
      setSymptomSuggestions([]);
      setShowSymptomSuggestions(false);
    } catch (error) {
      console.error('Error adding/updating symptom:', error);
      alert(`Failed to ${editingSymptom ? 'update' : 'add'} symptom`);
    }
  };

  // Handle editing symptom
  const handleEditSymptom = (symptom: dashboardService.Symptom) => {
    setEditingSymptom(symptom);
    setSymptomType(symptom.symptom_type);
    setSeverityValue(symptom.severity);
    setSymptomNotes(symptom.notes || '');
    setSymptomModalOpen(true);
  };

  // Handle deleting symptom
  const handleDeleteSymptom = async (symptomId: number) => {
    if (!window.confirm('Delete this symptom entry?')) {
      return;
    }

    try {
      await dashboardService.deleteSymptom(symptomId);
      setSymptoms(prev => prev.filter(s => s.id !== symptomId));
    } catch (error) {
      console.error('Error deleting symptom:', error);
      alert('Failed to delete symptom');
    }
  };

  // Toggle symptom note expansion
  const toggleSymptomNoteExpansion = (symptomId: number) => {
    setExpandedSymptomNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symptomId)) {
        newSet.delete(symptomId);
      } else {
        newSet.add(symptomId);
      }
      return newSet;
    });
  };

  // Toggle medication note expansion
  const toggleMedicationNoteExpansion = (medicationId: number) => {
    setExpandedMedicationNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(medicationId)) {
        newSet.delete(medicationId);
      } else {
        newSet.add(medicationId);
      }
      return newSet;
    });
  };

  // Search RxNorm for medication suggestions
  const searchMedications = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setMedicationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(searchTerm)}&ef=STRENGTHS_AND_FORMS&maxList=10`
      );
      const data = await response.json();

      // Response format: [count, codes, extraData, displayStrings]
      if (data && data[3]) {
        setMedicationSuggestions(data[3]);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching medication suggestions:', error);
    }
  };

  // Debounce medication search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchMedications(medicationName);
    }, 300);

    return () => clearTimeout(timer);
  }, [medicationName]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking on a suggestion
      if (target.closest('.medication-suggestions')) {
        return;
      }
      if (showSuggestions) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  // Handle medication name input change
  const handleMedicationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMedicationName(e.target.value);
  };

  // Handle selecting a medication from suggestions
  const handleSelectSuggestion = (suggestion: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setMedicationName(suggestion);
    setShowSuggestions(false);
    setMedicationSuggestions([]);
  };

  // Handle adding/updating medication
  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Ensure name is a string (in case it's somehow an array)
      const nameString = Array.isArray(medicationName) ? medicationName[0] : medicationName;

      const payload = {
        name: nameString,
        frequency: medicationFrequency,
        time: medicationTime || undefined,
        notes: medicationNotes || undefined,
      };

      if (editingMedication) {
        // Update existing medication
        const updated = await dashboardService.updateMedication(editingMedication.id, payload);
        setMedications(prev => prev.map(m => m.id === updated.id ? updated : m));
      } else {
        // Create new medication
        const newMedication = await dashboardService.createMedication(payload);
        setMedications(prev => [...prev, newMedication]);
        const newSummary = await dashboardService.getDashboardSummary();
        setSummary(newSummary);
      }

      setMedicationModalOpen(false);
      setEditingMedication(null);
      setMedicationName('');
      setMedicationFrequency('');
      setMedicationTime('');
      setMedicationNotes('');
      setMedicationSuggestions([]);
      setShowSuggestions(false);
    } catch (error: any) {
      console.error('Error adding/updating medication:', error);
      alert(`Failed to ${editingMedication ? 'update' : 'add'} medication: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Handle editing medication
  const handleEditMedication = (medication: dashboardService.Medication) => {
    setEditingMedication(medication);
    setMedicationName(medication.name);
    setMedicationFrequency(medication.frequency);
    setMedicationTime(medication.time || '');
    setMedicationNotes(medication.notes || '');
    setMedicationModalOpen(true);
  };

  // Handle deleting medication
  const handleDeleteMedication = async (medicationId: number) => {
    if (!window.confirm('Delete this medication? This will also remove all associated logs.')) {
      return;
    }

    try {
      await dashboardService.deleteMedication(medicationId);
      setMedications(prev => prev.filter(m => m.id !== medicationId));
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error) {
      console.error('Error deleting medication:', error);
      alert('Failed to delete medication');
    }
  };

  // Get dose count based on frequency
  const getDoseCount = (frequency: string): number => {
    switch (frequency) {
      case 'twice': return 2;
      case 'daily': return 1;
      case 'weekly': return 1;
      case 'asneeded': return 1;
      default: return 1;
    }
  };

  // Get dose label
  const getDoseLabel = (doseNumber: number, totalDoses: number): string => {
    if (totalDoses === 1) return '';
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
    return ordinals[doseNumber - 1] || `${doseNumber}th`;
  };

  // Handle logging medication as taken
  const handleMedicationCheck = async (medicationId: number, doseNumber: number = 1) => {
    const key = `${medicationId}-${doseNumber}`;

    try {
      const log = await dashboardService.logMedicationTaken(medicationId, doseNumber);
      setMedicationsTakenToday(prev => new Map(prev).set(key, log.id));
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error: any) {
      console.error('Error logging medication:', error);
      if (error.response?.status === 400) {
        alert(error.response.data.detail || `Dose ${doseNumber} already logged for today`);
      } else {
        alert('Failed to log medication');
      }
    }
  };

  // Handle unchecking medication
  const handleMedicationUncheck = async (
    logId: number,
    medicationId: number,
    doseNumber: number
  ) => {
    const key = `${medicationId}-${doseNumber}`;

    try {
      await dashboardService.deleteMedicationLog(logId);
      setMedicationsTakenToday(prev => {
        const newMap = new Map(prev);
        newMap.delete(key);
        return newMap;
      });
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error: any) {
      console.error('Error unchecking medication:', error);
      alert('Failed to uncheck medication');
    }
  };

  // Handle adding vital sign
  const handleAddVitalSign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newVitalSign = await dashboardService.createVitalSign({
        systolic_bp: systolicBP ? parseInt(systolicBP) : undefined,
        diastolic_bp: diastolicBP ? parseInt(diastolicBP) : undefined,
        heart_rate: heartRate ? parseInt(heartRate) : undefined,
        weight: weight ? parseInt(weight) : undefined,
      });
      setVitalSignModalOpen(false);
      setSystolicBP('');
      setDiastolicBP('');
      setHeartRate('');
      setWeight('');
      // Update only vital signs state and summary
      // Add new vital sign at the beginning (most recent first)
      setVitalSigns(prev => [newVitalSign, ...prev]);
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error) {
      console.error('Error adding vital sign:', error);
      alert('Failed to add vital sign');
    }
  };

  // Handle health profile update
  const handleUpdateHealthProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const profileData = {
        current_weight: profileWeight ? parseInt(profileWeight) : undefined,
        height: profileHeight ? parseInt(profileHeight) : undefined,
        activity_level: profileActivityLevel,
        current_conditions: profileConditions ? profileConditions.split(',').map((s) => s.trim()) : [],
        allergies: profileAllergies ? profileAllergies.split(',').map((s) => s.trim()) : [],
        family_history: profileFamilyHistory ? profileFamilyHistory.split(',').map((s) => s.trim()) : [],
      };

      let updatedProfile;
      if (healthProfile) {
        updatedProfile = await dashboardService.updateHealthProfile(profileData);
      } else {
        updatedProfile = await dashboardService.createHealthProfile(profileData);
      }

      setHealthProfileModalOpen(false);
      // Update only health profile state and summary (summary includes latest weight)
      setHealthProfile(updatedProfile);
      const newSummary = await dashboardService.getDashboardSummary();
      setSummary(newSummary);
    } catch (error) {
      console.error('Error updating health profile:', error);
      alert('Failed to update health profile');
    }
  };

  // Open health profile modal with existing data
  const openHealthProfileModal = () => {
    if (healthProfile) {
      setProfileWeight(healthProfile.current_weight?.toString() || '');
      setProfileHeight(healthProfile.height?.toString() || '');
      setProfileActivityLevel(healthProfile.activity_level || 'sedentary');
      setProfileConditions(healthProfile.current_conditions.join(', '));
      setProfileAllergies(healthProfile.allergies.join(', '));
      setProfileFamilyHistory(healthProfile.family_history.join(', '));
    }
    setHealthProfileModalOpen(true);
  };

  const calculateBMR = () => {
    if (!bmrGender || !bmrWeight || !bmrHeightFeet || !bmrAge) return;
  
    const weight = parseFloat(bmrWeight);
    const feet = parseFloat(bmrHeightFeet);
    const inches = bmrHeightInches ? parseFloat(bmrHeightInches) : 0;
    const age = parseFloat(bmrAge);
  
    // Convert feet and inches to total inches, then to cm
    const totalInches = (feet * 12) + inches;
    const weightKg = weight * 0.453592;
    const heightCm = totalInches * 2.54;
  
    // Mifflin-St Jeor Equation
    let bmr;
    if (bmrGender === 'male') {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
  
    setBmrResult(Math.round(bmr));
  };

  const calculateBMI = () => {
    if (!bmiWeight || !bmiHeightFeet) return;
  
    const weight = parseFloat(bmiWeight);
    const feet = parseFloat(bmiHeightFeet);
    const inches = bmiHeightInches ? parseFloat(bmiHeightInches) : 0;
  
    // Convert feet and inches to total inches
    const totalInches = (feet * 12) + inches;
  
    // BMI formula: (weight in lbs × 703) / (height in inches)²
    const bmi = (weight * 703) / (totalInches * totalInches);
  
    setBmiResult(parseFloat(bmi.toFixed(1)));
  };

  const getBMICategory = (bmi: number): { category: string; color: string } => {
    if (bmi < 18.5) return { category: 'Underweight', color: '#5DD3C6' };
    if (bmi < 25) return { category: 'Normal weight', color: '#4CAF50' };
    if (bmi < 30) return { category: 'Overweight', color: '#FFA726' };
    return { category: 'Obese', color: '#EF5350' };
  };

  const calculateHealthRisk = () => {
    const breakdown: { factor: string; score: number; maxScore: number }[] = [];
    let totalScore = 0;

    // 1. BMI Score (25 points max)
    if (healthProfile?.current_weight && healthProfile?.height) {
      const bmi = (healthProfile.current_weight * 703) / (healthProfile.height * healthProfile.height);
      let bmiScore = 25;
      if (bmi < 18.5) bmiScore = 15;
      else if (bmi >= 25 && bmi < 30) bmiScore = 15;
      else if (bmi >= 30) bmiScore = 5;
      breakdown.push({ factor: 'BMI', score: bmiScore, maxScore: 25 });
      totalScore += bmiScore;
    } else {
      breakdown.push({ factor: 'BMI', score: 0, maxScore: 25 });
    }

    // 2. Blood Pressure Score (20 points max)
    const latestVital = vitalSigns[0];
    if (latestVital?.systolic_bp && latestVital?.diastolic_bp) {
      let bpScore = 20;
      if (latestVital.systolic_bp >= 140 || latestVital.diastolic_bp >= 90) bpScore = 5;
      else if (latestVital.systolic_bp >= 130 || latestVital.diastolic_bp >= 80) bpScore = 12;
      else if (latestVital.systolic_bp >= 120) bpScore = 16;
      breakdown.push({ factor: 'Blood Pressure', score: bpScore, maxScore: 20 });
      totalScore += bpScore;
    } else {
      breakdown.push({ factor: 'Blood Pressure', score: 0, maxScore: 20 });
    }

    // 3. Activity Level Score (20 points max)
    const activityScores: Record<string, number> = {
      extremely_active: 20,
      very_active: 18,
      moderately_active: 14,
      lightly_active: 10,
      sedentary: 6
    };
    const activityScore = activityScores[healthProfile?.activity_level || 'sedentary'] || 6;
    breakdown.push({ factor: 'Activity Level', score: activityScore, maxScore: 20 });
    totalScore += activityScore;

    // 4. Conditions Score (15 points max)
    const conditionsCount = healthProfile?.current_conditions?.length || 0;
    const conditionsScore = Math.max(0, 15 - (conditionsCount * 5));
    breakdown.push({ factor: 'Health Conditions', score: conditionsScore, maxScore: 15 });
    totalScore += conditionsScore;

    // 5. Family History Score (10 points max)
    const familyCount = healthProfile?.family_history?.length || 0;
    const familyScore = Math.max(0, 10 - (familyCount * 3));
    breakdown.push({ factor: 'Family History', score: familyScore, maxScore: 10 });
    totalScore += familyScore;

    // 6. Age Score (10 points max)
    const age = user?.age || 30;
    let ageScore = 10;
    if (age >= 65) ageScore = 4;
    else if (age >= 55) ageScore = 6;
    else if (age >= 45) ageScore = 8;
    breakdown.push({ factor: 'Age Factor', score: ageScore, maxScore: 10 });
    totalScore += ageScore;

    // Determine category
    let category: string, color: string;
    if (totalScore >= 80) {
      category = 'Excellent';
      color = '#4CAF50';
    } else if (totalScore >= 60) {
      category = 'Good';
      color = '#2196F3';
    } else if (totalScore >= 40) {
      category = 'Fair';
      color = '#FFA726';
    } else {
      category = 'Needs Attention';
      color = '#EF5350';
    }

    setHealthRiskResult({ score: totalScore, category, color, breakdown });
  };

  const openCalculator = (type: string) => {
    if (type === 'water') {
      setWaterIntakeModalOpen(true);
    } else if (type === 'risk') {
      setHealthRiskModalOpen(true);
    }
  };

  const getSeverityLabel = (severity: number): string => {
    if (severity <= 3) return 'low';
    if (severity <= 6) return 'medium';
    return 'high';
  };

  const getSymptomIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      headache: '🤕',
      fatigue: '😴',
      fever: '🤒',
      cough: '😷',
      nausea: '🤢',
      pain: '😣',
    };
    return icons[type] || '🩹';
  };

  if (loading) {
    return <div className="dashboard-page">Loading...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">Personal Health Dashboard</h1>
          <p className="dashboard-subtitle">
            Track your health, monitor symptoms, and get personalized insights
          </p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon blue">💊</div>
            </div>
            <div className="stat-value">
              {summary?.medications_today || 0}/{summary?.total_medications || 0}
            </div>
            <div className="stat-label">Medications Today</div>
            <div className="stat-change positive">
              {summary && summary.medications_today >= summary.total_medications ? '✓ Complete' : '↑ On track'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon green">❤️</div>
            </div>
            <div className="stat-value">{summary?.latest_bp || '--/--'}</div>
            <div className="stat-label">Blood Pressure (mmHg)</div>
            <div className="stat-change positive">Latest reading</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon orange">⚖️</div>
            </div>
            <div className="stat-value">{summary?.latest_weight ? `${summary.latest_weight} lbs` : '--'}</div>
            <div className="stat-label">Current Weight</div>
            <div className="stat-change positive">Latest reading</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <div className="stat-icon cyan">🔥</div>
            </div>
            <div className="stat-value">{summary?.active_streak_days || 0}</div>
            <div className="stat-label">Day Streak</div>
            <div className="stat-change positive">↑ Keep it up!</div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Vital Signs Chart */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Vital Signs Trends</h3>
                <span className="card-action" onClick={() => setVitalSignModalOpen(true)}>
                  + Add Reading
                </span>
              </div>
              <div className="chart-container">
                {vitalSigns.length > 0 ? (
                  <canvas ref={chartRef}></canvas>
                ) : (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    No vital signs recorded yet. Click "+ Add Reading" to start tracking!
                  </p>
                )}
              </div>
            </div>

            {/* Symptom Tracker */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Symptom Tracker</h3>
                <span className="card-action" onClick={() => setSymptomModalOpen(true)}>
                  + Add Symptom
                </span>
              </div>
              <div className="symptom-list">
                {symptoms.length > 0 ? (
                  symptoms.slice(0, 5).map((symptom) => {
                    const isExpanded = expandedSymptomNotes.has(symptom.id);
                    const hasNotes = symptom.notes && symptom.notes.length > 0;
                    const truncatedNotes = hasNotes && symptom.notes!.length > 100
                      ? symptom.notes!.substring(0, 100) + '...'
                      : symptom.notes;
                    const shouldShowExpand = hasNotes && symptom.notes!.length > 100;

                    return (
                      <div key={symptom.id} className="symptom-item">
                        <div className="symptom-main">
                          <div className="symptom-icon">{getSymptomIcon(symptom.symptom_type)}</div>
                          <div className="symptom-details">
                            <div className="symptom-header">
                              <h4>{symptom.symptom_type.charAt(0).toUpperCase() + symptom.symptom_type.slice(1)}</h4>
                              <span className="symptom-time">
                                {new Date(symptom.created_at).toLocaleString()}
                              </span>
                            </div>
                            <span className={`severity-badge ${getSeverityLabel(symptom.severity)}`}>
                              {getSeverityLabel(symptom.severity)}
                            </span>

                            {hasNotes && (
                              <div className="symptom-notes">
                                <p>{isExpanded ? symptom.notes : truncatedNotes}</p>
                                {shouldShowExpand && (
                                  <button
                                    className="expand-notes-btn"
                                    onClick={() => toggleSymptomNoteExpansion(symptom.id)}
                                  >
                                    {isExpanded ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="symptom-actions">
                          <button
                            className="icon-btn edit-btn"
                            onClick={() => handleEditSymptom(symptom)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="icon-btn delete-btn"
                            onClick={() => handleDeleteSymptom(symptom.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                    No symptoms logged yet
                  </p>
                )}
              </div>
            </div>

            {/* Health Calculators */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Health Calculators</h3>
              </div>
              <div className="calculator-grid">
                <div className="calculator-card" onClick={() => openCalculator('risk')}>
                  <div className="calculator-icon">⚠️</div>
                  <div className="calculator-name">Health Risk</div>
                </div>
                <div className="calculator-card" onClick={() => setBmiModalOpen(true)}>
                  <div className="calculator-icon">📏</div>
                  <div className="calculator-name">BMI Calculator</div>
                </div>
                <div className="calculator-card" onClick={() => setBmrModalOpen(true)}>
                  <div className="calculator-icon">🔥</div>
                  <div className="calculator-name">BMR Calculator</div>
                </div>
                <div className="calculator-card" onClick={() => openCalculator('water')}>
                  <div className="calculator-icon">💧</div>
                  <div className="calculator-name">Water Intake</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Medication Reminders */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Medications</h3>
                <span className="card-action" onClick={() => setMedicationModalOpen(true)}>
                  + Add
                </span>
              </div>
              <div className="medication-list">
                {medications.length > 0 ? (
                  medications.map((medication) => {
                    const doseCount = getDoseCount(medication.frequency);

                    return (
                      <div key={medication.id} className="medication-item">
                        <div className="medication-info">
                          <div className="medication-icon">💊</div>
                          <div className="medication-details">
                            <h4>{medication.name}</h4>
                            <span className="medication-time">
                              {medication.time || ''} {medication.frequency}
                            </span>
                            {medication.notes && medication.notes.length > 0 && (
                              <div className="medication-notes">
                                <p>
                                  {expandedMedicationNotes.has(medication.id)
                                    ? medication.notes
                                    : medication.notes.length > 100
                                      ? medication.notes.substring(0, 100) + '...'
                                      : medication.notes
                                  }
                                </p>
                                {medication.notes.length > 100 && (
                                  <button
                                    className="expand-notes-btn"
                                    onClick={() => toggleMedicationNoteExpansion(medication.id)}
                                  >
                                    {expandedMedicationNotes.has(medication.id) ? 'Show less' : 'Show more'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="medication-actions">
                          <div className="checkbox-group">
                            {Array.from({ length: doseCount }, (_, i) => {
                              const doseNumber = i + 1;
                              const key = `${medication.id}-${doseNumber}`;
                              const isTaken = medicationsTakenToday.has(key);
                              const logId = medicationsTakenToday.get(key);
                              const label = getDoseLabel(doseNumber, doseCount);

                              return (
                                <div key={doseNumber} className="dose-checkbox">
                                  {label && <span className="dose-label">{label}</span>}
                                  <button
                                    className={`check-btn ${isTaken ? 'checked' : ''}`}
                                    onClick={() => {
                                      if (isTaken && logId) {
                                        handleMedicationUncheck(logId, medication.id, doseNumber);
                                      } else {
                                        handleMedicationCheck(medication.id, doseNumber);
                                      }
                                    }}
                                  >
                                    {isTaken ? '✓' : ''}
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            className="icon-btn edit-btn"
                            onClick={() => handleEditMedication(medication)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="icon-btn delete-btn"
                            onClick={() => handleDeleteMedication(medication.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                    No medications added yet
                  </p>
                )}
              </div>
            </div>

            {/* Health Profile */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Health Profile</h3>
                <span className="card-action" onClick={openHealthProfileModal}>
                  {healthProfile ? 'Edit' : 'Create'}
                </span>
              </div>
              {healthProfile ? (
                <>
                  <div className="profile-section">
                    <h4>Current Conditions</h4>
                    <div className="profile-tags">
                      {healthProfile.current_conditions.length > 0 ? (
                        healthProfile.current_conditions.map((condition, idx) => (
                          <span key={idx} className="profile-tag">
                            {condition}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None listed</span>
                      )}
                    </div>
                  </div>
                  <div className="profile-section">
                    <h4>Allergies</h4>
                    <div className="profile-tags">
                      {healthProfile.allergies.length > 0 ? (
                        healthProfile.allergies.map((allergy, idx) => (
                          <span key={idx} className="profile-tag">
                            {allergy}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None listed</span>
                      )}
                    </div>
                  </div>
                  <div className="profile-section">
                    <h4>Family History</h4>
                    <div className="profile-tags">
                      {healthProfile.family_history.length > 0 ? (
                        healthProfile.family_history.map((history, idx) => (
                          <span key={idx} className="profile-tag">
                            {history}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#666' }}>None listed</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>
                  Create your health profile to get started
                </p>
              )}
            </div>

            {/* AI Recommendations */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">AI Recommendations</h3>
              </div>
              <div className="recommendations-list">
                <div className="recommendation-item">
                  <h5>💪 Increase Physical Activity</h5>
                  <p>Based on your weight goals, try adding 15 minutes of walking daily.</p>
                </div>
                <div className="recommendation-item">
                  <h5>😴 Improve Sleep Schedule</h5>
                  <p>Your symptom patterns suggest inconsistent sleep. Aim for 7-8 hours nightly.</p>
                </div>
                <div className="recommendation-item">
                  <h5>💧 Hydration Reminder</h5>
                  <p>Drink at least 8 glasses of water daily to help with headaches.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Symptom Modal */}
      {symptomModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSymptomModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingSymptom ? 'Edit' : 'Log'} Symptom</h3>
              <button className="close-btn" onClick={() => {
                setSymptomModalOpen(false);
                setEditingSymptom(null);
              }}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddSymptom}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Symptom Type</label>
                <input
                  type="text"
                  placeholder="Start typing symptom..."
                  required
                  value={symptomType}
                  onChange={handleSymptomTypeChange}
                  onFocus={() => symptomSuggestions.length > 0 && setShowSymptomSuggestions(true)}
                />
                {showSymptomSuggestions && symptomSuggestions.length > 0 && (
                  <div
                    className="symptom-suggestions"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    {symptomSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={(e) => handleSelectSymptom(suggestion, e)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: index < symptomSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Severity (1-10)</label>
                <div className="slider-container">
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="10"
                    value={severityValue}
                    onChange={(e) => setSeverityValue(Number(e.target.value))}
                  />
                  <span className="slider-value">{severityValue}</span>
                </div>
              </div>
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Any additional details..."
                  value={symptomNotes}
                  onChange={(e) => setSymptomNotes(e.target.value)}
                ></textarea>
              </div>
              <button type="submit" className="submit-btn">
                {editingSymptom ? 'Update' : 'Log'} Symptom
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Medication Modal */}
      {medicationModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMedicationModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingMedication ? 'Edit' : 'Add'} Medication</h3>
              <button className="close-btn" onClick={() => {
                setMedicationModalOpen(false);
                setEditingMedication(null);
              }}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddMedication}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Medication Name</label>
                <input
                  type="text"
                  placeholder="e.g., Aspirin 81mg"
                  required
                  value={medicationName}
                  onChange={handleMedicationNameChange}
                  onFocus={() => medicationSuggestions.length > 0 && setShowSuggestions(true)}
                />
                {showSuggestions && medicationSuggestions.length > 0 && (
                  <div
                    className="medication-suggestions"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    {medicationSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={(e) => handleSelectSuggestion(suggestion, e)}
                        style={{
                          padding: '10px 15px',
                          cursor: 'pointer',
                          borderBottom: index < medicationSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select
                  required
                  value={medicationFrequency}
                  onChange={(e) => setMedicationFrequency(e.target.value)}
                >
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="twice">Twice daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="asneeded">As needed</option>
                </select>
              </div>
              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={medicationTime}
                  onChange={(e) => setMedicationTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Instructions, reminders..."
                  value={medicationNotes}
                  onChange={(e) => setMedicationNotes(e.target.value)}
                ></textarea>
              </div>
              <button type="submit" className="submit-btn">
                {editingMedication ? 'Update' : 'Add'} Medication
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Vital Sign Modal */}
      {vitalSignModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setVitalSignModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Log Vital Signs</h3>
              <button className="close-btn" onClick={() => setVitalSignModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddVitalSign}>
              <div className="form-group">
                <label>Blood Pressure (Systolic)</label>
                <input
                  type="number"
                  placeholder="e.g., 120"
                  value={systolicBP}
                  onChange={(e) => setSystolicBP(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="form-group">
                <label>Blood Pressure (Diastolic)</label>
                <input
                  type="number"
                  placeholder="e.g., 80"
                  value={diastolicBP}
                  onChange={(e) => setDiastolicBP(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="form-group">
                <label>Heart Rate (bpm)</label>
                <input
                  type="number"
                  placeholder="e.g., 72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="form-group">
                <label>Weight (lbs)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 165"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <button type="submit" className="submit-btn">
                Log Vital Signs
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Health Profile Modal */}
      {healthProfileModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHealthProfileModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{healthProfile ? 'Edit' : 'Create'} Health Profile</h3>
              <button className="close-btn" onClick={() => setHealthProfileModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateHealthProfile}>
              <div className="form-group">
                <label>Current Weight (lbs)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 165"
                  value={profileWeight}
                  onChange={(e) => setProfileWeight(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="form-group">
                <label>Height (inches)</label>
                <input
                  type="number"
                  step="1"
                  placeholder="e.g., 68"
                  value={profileHeight}
                  onChange={(e) => setProfileHeight(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
              <div className="form-group">
                <label>Activity Level</label>
                <select
                  value={profileActivityLevel}
                  onChange={(e) => setProfileActivityLevel(e.target.value)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    fontFamily: 'DM Sans, sans-serif',
                    color: '#1a2332',
                  }}
                >
                  <option value="sedentary">Sedentary (little/no exercise)</option>
                  <option value="lightly_active">Lightly Active (1-3 days/week)</option>
                  <option value="moderately_active">Moderately Active (3-5 days/week)</option>
                  <option value="very_active">Very Active (6-7 days/week)</option>
                  <option value="extremely_active">Extremely Active (physical job + exercise)</option>
                </select>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.25rem',
                  display: 'block'
                }}>
                  Used to calculate daily water intake recommendation
                </span>
              </div>
              <div className="form-group">
                <label>Current Conditions (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Hypertension, Type 2 Diabetes"
                  value={profileConditions}
                  onChange={(e) => setProfileConditions(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Allergies (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Penicillin, Peanuts"
                  value={profileAllergies}
                  onChange={(e) => setProfileAllergies(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Family History (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Heart Disease, Diabetes"
                  value={profileFamilyHistory}
                  onChange={(e) => setProfileFamilyHistory(e.target.value)}
                />
              </div>
              <button type="submit" className="submit-btn">
                {healthProfile ? 'Update' : 'Create'} Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BMR Calculator Modal */}
      {bmrModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBmrModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">BMR Calculator</h3>
              <button className="close-btn" onClick={() => setBmrModalOpen(false)}>
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem 0' }}>
              {/* Gender Selection */}
              <div className="form-group">
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>Gender</label>
                <div style={{ 
                  display: 'flex', 
                  gap: '0',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  width: 'fit-content'
                }}>
                  <button
                    type="button"
                    onClick={() => setBmrGender('male')}
                    style={{
                      padding: '0.75rem 2rem',
                      border: 'none',
                      backgroundColor: bmrGender === 'male' ? '#2E5EAA' : 'white',
                      color: bmrGender === 'male' ? 'white' : '#666',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: bmrGender === 'male' ? '600' : '400',
                      transition: 'all 0.2s ease',
                      borderRight: '1px solid #e0e0e0'
                    }}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setBmrGender('female')}
                    style={{
                      padding: '0.75rem 2rem',
                      border: 'none',
                      backgroundColor: bmrGender === 'female' ? '#2E5EAA' : 'white',
                      color: bmrGender === 'female' ? 'white' : '#666',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: bmrGender === 'female' ? '600' : '400',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Female
                  </button>
                </div>
              </div>

              {/* Weight Input */}
              <div className="form-group">
                <label>Weight (lbs)</label>
                <input
                  type="number"
                  placeholder="e.g., 165"
                  value={bmrWeight}
                  onChange={(e) => setBmrWeight(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  step="1"
                />
              </div>

              {/* Height Input */}
              <div className="form-group">
                <label>Height</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Feet"
                      value={bmrHeightFeet}
                      onChange={(e) => setBmrHeightFeet(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      min="0"
                      max="8"
                      step="1"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Inches"
                      value={bmrHeightInches}
                      onChange={(e) => setBmrHeightInches(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      min="0"
                      max="11"
                      step="1"
                    />
                  </div>
                </div>
              </div>

              {/* Age Input */}
              <div className="form-group">
                <label>Age (years)</label>
                <input
                  type="number"
                  placeholder="e.g., 30"
                  value={bmrAge}
                  onChange={(e) => setBmrAge(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  step="1"
                />
              </div>

              {/* BMR Result */}
              {bmrResult && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1.5rem',
                  backgroundColor: '#f0f7ff',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #2E5EAA'
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: '#666', 
                    marginBottom: '0.5rem',
                    fontWeight: '500'
                  }}>
                    Your Basal Metabolic Rate is:
                  </p>
                  <p style={{ 
                    fontSize: '2rem', 
                    fontWeight: '700', 
                    color: '#2E5EAA',
                    margin: '0'
                  }}>
                    {bmrResult} calories/day
                  </p>
                  <p style={{ 
                    fontSize: '0.8rem', 
                    color: '#888', 
                    marginTop: '0.75rem',
                    fontStyle: 'italic'
                  }}>
                    This is the number of calories your body burns at rest
                  </p>
                </div>
              )}
            </div>
            <button 
              type="button" 
              className="submit-btn"
              onClick={calculateBMR}
              disabled={!bmrGender || !bmrWeight || !bmrHeightFeet || !bmrAge}
              style={{
                opacity: (!bmrGender || !bmrWeight || !bmrHeightFeet || !bmrAge) ? 0.5 : 1,
                cursor: (!bmrGender || !bmrWeight || !bmrHeightFeet || !bmrAge) ? 'not-allowed' : 'pointer'
              }}
            >
              Calculate BMR
            </button>
          </div>
        </div>
      )}

      {/* BMI Calculator Modal */}
      {bmiModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBmiModalOpen(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">BMI Calculator</h3>
              <button className="close-btn" onClick={() => setBmiModalOpen(false)}>
                ×
              </button>
            </div>
            <div style={{ padding: '1.5rem 0' }}>
              {/* Weight Input */}
              <div className="form-group">
                <label>Weight (lbs)</label>
                <input
                  type="number"
                  placeholder="e.g., 165"
                  value={bmiWeight}
                  onChange={(e) => setBmiWeight(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  step="1"
                />
              </div>

              {/* Height Input */}
              <div className="form-group">
                <label>Height</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Feet"
                      value={bmiHeightFeet}
                      onChange={(e) => setBmiHeightFeet(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      min="0"
                      max="8"
                      step="1"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      placeholder="Inches"
                      value={bmiHeightInches}
                      onChange={(e) => setBmiHeightInches(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      min="0"
                      max="11"
                      step="1"
                    />
                  </div>
                </div>
              </div>

              {/* BMI Result */}
              {bmiResult && (
                <div style={{
                  marginTop: '1.5rem',
                  padding: '1.5rem',
                  backgroundColor: '#f0f7ff',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #2E5EAA'
                }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: '#666', 
                    marginBottom: '0.5rem',
                    fontWeight: '500'
                  }}>
                    Your Body Mass Index is:
                  </p>
                  <p style={{ 
                    fontSize: '2.5rem', 
                    fontWeight: '700', 
                    color: '#2E5EAA',
                    margin: '0.25rem 0'
                  }}>
                    {bmiResult}
                  </p>
                  <p style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: '600', 
                    color: getBMICategory(bmiResult).color,
                    marginTop: '0.5rem'
                  }}>
                    {getBMICategory(bmiResult).category}
                  </p>
                  <div style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e0e0e0',
                    fontSize: '0.8rem',
                    color: '#666',
                    textAlign: 'left'
                  }}>
                    <p style={{ margin: '0.25rem 0' }}>• Underweight: Below 18.5</p>
                    <p style={{ margin: '0.25rem 0' }}>• Normal weight: 18.5 - 24.9</p>
                    <p style={{ margin: '0.25rem 0' }}>• Overweight: 25 - 29.9</p>
                    <p style={{ margin: '0.25rem 0' }}>• Obese: 30 and above</p>
                  </div>
                </div>
              )}
            </div>
            <button 
              type="button" 
              className="submit-btn"
              onClick={calculateBMI}
              disabled={!bmiWeight || !bmiHeightFeet}
              style={{
                opacity: (!bmiWeight || !bmiHeightFeet) ? 0.5 : 1,
                cursor: (!bmiWeight || !bmiHeightFeet) ? 'not-allowed' : 'pointer'
              }}
            >
              Calculate BMI
            </button>
          </div>
        </div>
      )}

      {/* Water Intake Modal */}
      {waterIntakeModalOpen && (
        <WaterIntakeModal onClose={() => setWaterIntakeModalOpen(false)} />
      )}

      {/* Health Risk Calculator Modal */}
      {healthRiskModalOpen && (
        <div
          className="modal active"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHealthRiskModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Health Risk Calculator</h3>
              <button className="close-btn" onClick={() => setHealthRiskModalOpen(false)}>
                x
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Calculate your overall health score based on your profile data, vital signs, and lifestyle factors.
              </p>

              {healthRiskResult && (
                <div style={{ marginBottom: '1.5rem' }}>
                  {/* Score Display */}
                  <div style={{
                    textAlign: 'center',
                    padding: '1.5rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '12px',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{
                      fontSize: '3rem',
                      fontWeight: '700',
                      color: healthRiskResult.color
                    }}>
                      {healthRiskResult.score}
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#666',
                      marginBottom: '0.5rem'
                    }}>
                      out of 100
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      backgroundColor: healthRiskResult.color,
                      color: 'white',
                      borderRadius: '20px',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}>
                      {healthRiskResult.category}
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div>
                    <h4 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#333' }}>Score Breakdown</h4>
                    {healthRiskResult.breakdown.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.85rem', color: '#555' }}>{item.factor}</span>
                          <span style={{ fontSize: '0.85rem', color: '#333', fontWeight: '500' }}>
                            {item.score}/{item.maxScore}
                          </span>
                        </div>
                        <div style={{
                          height: '8px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${(item.score / item.maxScore) * 100}%`,
                            backgroundColor: item.score === item.maxScore ? '#4CAF50' :
                              item.score >= item.maxScore * 0.7 ? '#2196F3' :
                              item.score >= item.maxScore * 0.4 ? '#FFA726' : '#EF5350',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!healthRiskResult && (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '12px',
                  color: '#666'
                }}>
                  <p>Click the button below to calculate your health risk score based on your current health data.</p>
                </div>
              )}
            </div>
            <button
              type="button"
              className="submit-btn"
              onClick={calculateHealthRisk}
            >
              {healthRiskResult ? 'Recalculate' : 'Calculate'} Health Score
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
