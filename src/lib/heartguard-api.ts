import type { PredictRequest, PredictResponse, HealthResponse, ModelInfoResponse, PatientData } from "./heartguard-types";

const API_BASE = "http://localhost:8002";

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health/`);
  if (!res.ok) throw new Error("API unreachable");
  return res.json();
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  const res = await fetch(`${API_BASE}/health/model`);
  if (!res.ok) throw new Error("Failed to fetch model info");
  return res.json();
}

export async function getExampleData(): Promise<{ patient_data: PatientData }> {
  const res = await fetch(`${API_BASE}/predict/example`);
  if (!res.ok) throw new Error("Failed to fetch example");
  return res.json();
}

export async function predict(request: PredictRequest): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (res.status === 422) {
    const err = await res.json();
    throw new Error(JSON.stringify(err.detail || err.validation_errors || "Validation failed"));
  }
  if (!res.ok) throw new Error("Prediction failed");
  return res.json();
}
