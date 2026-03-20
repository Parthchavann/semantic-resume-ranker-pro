export interface PatientData {
  age: number;
  sex: number;
  cp: number;
  trestbps: number;
  chol: number;
  fbs: number;
  restecg: number;
  thalach: number;
  exang: number;
  oldpeak: number;
  slope: number;
  ca: number;
  thal: number;
}

export interface PredictOptions {
  include_explanation: boolean;
  include_llm_explanation: boolean;
}

export interface PredictRequest {
  patient_data: PatientData;
  options: PredictOptions;
}

export interface FeatureContribution {
  shap_value: number;
  feature_value: number;
  impact: "increases_risk" | "decreases_risk";
}

export interface RiskFactor {
  feature: string;
  contribution: number;
  feature_value: number;
  explanation: string;
}

export interface Explanation {
  prediction_probability: number;
  expected_value: number;
  feature_contributions: Record<string, FeatureContribution>;
  top_risk_factors: RiskFactor[];
  top_protective_factors: RiskFactor[];
}

export interface LLMExplanation {
  risk_explanation: string;
  lifestyle_recommendations: string[];
  doctor_consultation_questions: string[];
  generated_timestamp: string;
  risk_level: string;
}

export interface ModelInfo {
  model_name: string;
  model_version: string;
  training_timestamp: string;
}

export interface PredictResponse {
  prediction_id: string;
  timestamp: string;
  success: boolean;
  prediction: number;
  risk_probability: number;
  risk_level: "Low" | "Moderate" | "High";
  confidence_interval: [number, number];
  model_info: ModelInfo;
  explanation?: Explanation;
  llm_explanation?: LLMExplanation;
  medical_disclaimer: string;
  error?: string;
}

export interface HealthResponse {
  timestamp: string;
  service_status: string;
  components: Record<string, string>;
}

export interface ModelInfoResponse {
  model_name: string;
  model_version: string;
  training_timestamp: string;
  metrics?: Record<string, number>;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  age: number;
  sex: number;
  risk_level: string;
  risk_probability: number;
  result: PredictResponse;
}
