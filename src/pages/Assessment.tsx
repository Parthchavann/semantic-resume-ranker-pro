import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ArrowLeft, ArrowRight, Info, AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { predict, getExampleData } from "@/lib/heartguard-api";
import { FIELD_TOOLTIPS, MEDICAL_DISCLAIMER } from "@/lib/heartguard-constants";
import type { PatientData, PredictResponse } from "@/lib/heartguard-types";
import { Footer } from "@/components/heartguard/Footer";

const DEFAULT_DATA: PatientData = {
  age: 55, sex: 1, cp: 0, trestbps: 120, chol: 200,
  fbs: 0, restecg: 0, thalach: 150, exang: 0,
  oldpeak: 0, slope: 0, ca: 0, thal: 0,
};

const STEPS = ["Personal Info", "Cardiac Symptoms", "Blood Tests", "ECG & Imaging"];

function FieldTooltip({ field }: { field: string }) {
  const tip = FIELD_TOOLTIPS[field];
  if (!tip) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

function Warning({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-xs text-amber-600">{text}</span>
    </div>
  );
}

export default function Assessment() {
  const navigate = useNavigate();
  const [data, setData] = useState<PatientData>(DEFAULT_DATA);
  const [includeShap, setIncludeShap] = useState(true);
  const [includeLlm, setIncludeLlm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const set = (field: keyof PatientData, value: number) =>
    setData((d) => ({ ...d, [field]: value }));

  const handleLoadExample = async () => {
    try {
      const ex = await getExampleData();
      setData(ex.patient_data);
    } catch {
      // Use defaults
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setLoadingStep(1);

    const timer1 = setTimeout(() => setLoadingStep(2), 2000);
    const timer2 = setTimeout(() => setLoadingStep(3), 5000);

    try {
      const result = await predict({
        patient_data: data,
        options: { include_explanation: includeShap, include_llm_explanation: includeLlm },
      });
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!result.success) {
        setError(result.error || "Prediction failed");
        setLoading(false);
        return;
      }

      // Store in session for results page
      const historyRaw = sessionStorage.getItem("heartguard_history");
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      history.unshift({
        id: result.prediction_id,
        timestamp: result.timestamp,
        age: data.age,
        sex: data.sex,
        risk_level: result.risk_level,
        risk_probability: result.risk_probability,
        result,
      });
      sessionStorage.setItem("heartguard_history", JSON.stringify(history.slice(0, 10)));
      sessionStorage.setItem("heartguard_current", JSON.stringify(result));
      navigate("/results");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setLoading(false);
    }
  };

  const renderNumberField = (field: keyof PatientData, label: string, min: number, max: number, stepVal: number = 1) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        <FieldTooltip field={field} />
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={stepVal}
        value={data[field]}
        onChange={(e) => set(field, parseFloat(e.target.value) || 0)}
        className="h-10"
      />
      <Warning show={field === "trestbps" && data.trestbps >= 140} text="Stage 1+ hypertension range" />
      <Warning show={field === "chol" && data.chol >= 240} text="High cholesterol risk range" />
      <Warning show={field === "chol" && data.chol >= 200 && data.chol < 240} text="Borderline cholesterol" />
      <Warning show={field === "oldpeak" && data.oldpeak >= 2.0} text="Possible ischemia indicator" />
      <Warning show={field === "thalach" && data.thalach < 100} text="Low cardiac fitness indicator" />
    </div>
  );

  const renderSelectField = (field: keyof PatientData, label: string, options: { value: number; label: string }[]) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        <FieldTooltip field={field} />
      </Label>
      <Select value={String(data[field])} onValueChange={(v) => set(field, parseInt(v))}>
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Warning show={field === "ca" && data.ca >= 2} text="Multiple vessel blockages detected" />
    </div>
  );

  const sections = [
    // Step 0: Personal Info
    <div key="0" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderNumberField("age", "Age (years)", 18, 120)}
      {renderSelectField("sex", "Sex", [
        { value: 0, label: "Female" },
        { value: 1, label: "Male" },
      ])}
    </div>,
    // Step 1: Cardiac Symptoms
    <div key="1" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderSelectField("cp", "Chest Pain Type", [
        { value: 0, label: "Typical Angina" },
        { value: 1, label: "Atypical Angina" },
        { value: 2, label: "Non-Anginal Pain" },
        { value: 3, label: "Asymptomatic" },
      ])}
      {renderSelectField("exang", "Exercise-Induced Angina", [
        { value: 0, label: "No" },
        { value: 1, label: "Yes" },
      ])}
      {renderNumberField("thalach", "Max Heart Rate Achieved (bpm)", 60, 220)}
    </div>,
    // Step 2: Blood Tests
    <div key="2" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderNumberField("trestbps", "Resting Blood Pressure (mm Hg)", 80, 200)}
      {renderNumberField("chol", "Serum Cholesterol (mg/dl)", 100, 600)}
      {renderSelectField("fbs", "Fasting Blood Sugar > 120 mg/dl", [
        { value: 0, label: "No" },
        { value: 1, label: "Yes" },
      ])}
    </div>,
    // Step 3: ECG & Imaging
    <div key="3" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderSelectField("restecg", "Resting ECG Results", [
        { value: 0, label: "Normal" },
        { value: 1, label: "ST-T Wave Abnormality" },
        { value: 2, label: "Left Ventricular Hypertrophy" },
      ])}
      {renderNumberField("oldpeak", "ST Depression", 0, 10, 0.1)}
      {renderSelectField("slope", "Slope of Peak Exercise ST Segment", [
        { value: 0, label: "Upsloping" },
        { value: 1, label: "Flat" },
        { value: 2, label: "Downsloping" },
      ])}
      {renderSelectField("ca", "Major Vessels Blocked (0–4)", [
        { value: 0, label: "0" },
        { value: 1, label: "1" },
        { value: 2, label: "2" },
        { value: 3, label: "3" },
        { value: 4, label: "4" },
      ])}
      {renderSelectField("thal", "Thalassemia", [
        { value: 0, label: "Normal" },
        { value: 1, label: "Fixed Defect" },
        { value: 2, label: "Reversible Defect" },
        { value: 3, label: "Not Described" },
      ])}
    </div>,
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" fill="currentColor" />
            <span className="font-semibold">HeartGuard</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      {/* Progress stepper */}
      <div className="border-b bg-muted/30">
        <div className="container py-3">
          <div className="flex items-center justify-center gap-1 text-sm">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                  i === step ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="hidden sm:inline">{s}</span>
                <span className="sm:hidden">{i + 1}</span>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground ml-1" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8"
        >
          {/* Section title */}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{STEPS[step]}</h2>
            <p className="text-sm text-muted-foreground">
              {step === 0 && "Basic demographic information"}
              {step === 1 && "Symptoms related to cardiac function"}
              {step === 2 && "Blood test results and vital signs"}
              {step === 3 && "Electrocardiogram and imaging data"}
            </p>
          </div>

          {/* Fields */}
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {sections[step]}
          </motion.div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <div />
            )}
          </div>

          {/* Options & submit (always visible) */}
          {step === STEPS.length - 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="space-y-6 border-t pt-6"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeShap} onCheckedChange={(v) => setIncludeShap(!!v)} />
                  Include SHAP explanation
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeLlm} onCheckedChange={(v) => setIncludeLlm(!!v)} />
                  Include AI explanation
                </label>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="h-11 px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.97] transition-transform"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analysing…
                    </>
                  ) : (
                    "Analyse Risk"
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLoadExample} disabled={loading}>
                  Load example
                </Button>
              </div>

              {loading && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  {[
                    { step: 1, label: "Running ML model…" },
                    { step: 2, label: "Computing SHAP explanations…" },
                    { step: 3, label: "Generating AI explanation (please wait)…" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-3 text-sm">
                      {loadingStep >= s.step ? (
                        loadingStep > s.step ? (
                          <span className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )
                      ) : (
                        <span className="h-5 w-5 rounded-full border-2 border-muted" />
                      )}
                      <span className={loadingStep >= s.step ? "text-foreground" : "text-muted-foreground"}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                🔒 No data is stored — your information never leaves this browser session.
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>

      <div className="border-t bg-muted/30">
        <div className="container py-3">
          <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
            ⚕️ {MEDICAL_DISCLAIMER}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
