// Common symptoms list for autocomplete
// This list contains common medical symptoms organized by category

export const COMMON_SYMPTOMS = [
  // Head and Neurological
  'Headache',
  'Migraine',
  'Tension headache',
  'Cluster headache',
  'Dizziness',
  'Vertigo',
  'Lightheadedness',
  'Fainting',
  'Memory loss',
  'Confusion',
  'Difficulty concentrating',
  'Brain fog',
  'Numbness in face',
  'Tingling in face',
  'Vision changes',
  'Blurred vision',
  'Double vision',
  'Light sensitivity',
  'Sound sensitivity',

  // Respiratory
  'Cough',
  'Dry cough',
  'Productive cough',
  'Shortness of breath',
  'Wheezing',
  'Chest tightness',
  'Difficulty breathing',
  'Rapid breathing',
  'Congestion',
  'Runny nose',
  'Stuffy nose',
  'Sneezing',
  'Sore throat',
  'Scratchy throat',
  'Hoarseness',
  'Loss of voice',

  // Gastrointestinal
  'Nausea',
  'Vomiting',
  'Abdominal pain',
  'Stomach pain',
  'Cramping',
  'Bloating',
  'Gas',
  'Heartburn',
  'Acid reflux',
  'Indigestion',
  'Diarrhea',
  'Constipation',
  'Loss of appetite',
  'Increased appetite',
  'Difficulty swallowing',
  'Bloody stool',
  'Black stool',

  // Musculoskeletal
  'Back pain',
  'Lower back pain',
  'Upper back pain',
  'Neck pain',
  'Shoulder pain',
  'Knee pain',
  'Hip pain',
  'Ankle pain',
  'Wrist pain',
  'Elbow pain',
  'Joint pain',
  'Joint stiffness',
  'Muscle pain',
  'Muscle aches',
  'Muscle weakness',
  'Muscle cramps',
  'Muscle spasms',
  'Numbness in limbs',
  'Tingling in hands',
  'Tingling in feet',

  // General/Constitutional
  'Fatigue',
  'Extreme fatigue',
  'Tiredness',
  'Weakness',
  'Fever',
  'Chills',
  'Night sweats',
  'Weight loss',
  'Weight gain',
  'Increased thirst',
  'Increased urination',
  'Decreased urination',
  'Swelling',
  'Leg swelling',
  'Ankle swelling',
  'Facial swelling',

  // Cardiovascular
  'Chest pain',
  'Heart palpitations',
  'Irregular heartbeat',
  'Racing heart',
  'Slow heartbeat',
  'High blood pressure',
  'Low blood pressure',
  'Cold hands',
  'Cold feet',

  // Skin
  'Rash',
  'Itching',
  'Hives',
  'Dry skin',
  'Sweating',
  'Excessive sweating',
  'Pale skin',
  'Flushed skin',
  'Bruising',
  'Hair loss',
  'Nail changes',

  // Mental Health
  'Anxiety',
  'Nervousness',
  'Panic attacks',
  'Depression',
  'Mood swings',
  'Irritability',
  'Sadness',
  'Restlessness',
  'Insomnia',
  'Difficulty sleeping',
  'Excessive sleeping',
  'Nightmares',

  // Ear, Nose, Throat
  'Ear pain',
  'Ringing in ears',
  'Hearing loss',
  'Nosebleed',
  'Post-nasal drip',
  'Sinus pressure',
  'Jaw pain',
  'Toothache',
  'Mouth sores',
  'Dry mouth',
  'Bad breath',

  // Urinary
  'Painful urination',
  'Frequent urination',
  'Urgent urination',
  'Blood in urine',
  'Dark urine',
  'Cloudy urine',
  'Incontinence',

  // Reproductive (General)
  'Pelvic pain',
  'Groin pain',
  'Breast pain',
  'Breast tenderness',
  'Unusual discharge',

  // Other
  'Swollen lymph nodes',
  'Swollen glands',
  'Dehydration',
  'Tremors',
  'Shaking',
  'Loss of balance',
  'Coordination problems',
  'Sensitivity to cold',
  'Sensitivity to heat',
  'Changes in taste',
  'Loss of taste',
  'Loss of smell',
  'Bad taste in mouth',
];

// Helper function to filter symptoms based on search term
export const filterSymptoms = (searchTerm: string): string[] => {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  const lowerSearch = searchTerm.toLowerCase();
  return COMMON_SYMPTOMS
    .filter(symptom => symptom.toLowerCase().includes(lowerSearch))
    .slice(0, 10); // Limit to 10 results
};
