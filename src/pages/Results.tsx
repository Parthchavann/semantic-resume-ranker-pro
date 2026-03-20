import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, ArrowLeft, Printer, Clock, Trash2, ChevronRight,
  Stethoscope, Lightbulb, HelpCircle, Info, Activity, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { getFeatureLabel, getFeatureUnit, getRiskColor, MEDICAL_DISCLAIMER } from "@/lib/heartguard-constants";
import { getModelInfo } from "@/lib/heartguard-api";
import type { PredictResponse, HistoryEntry, ModelInfoResponse } from "@/lib/heartguard-types";
import { Footer } from "@/components/heartguard/Footer";

function RiskGauge({ probability, riskLevel }: { probability: number; riskLevel: string }) {
  const pct = Math.round(probability * 100);
  const colors = getRiskColor(riskLevel);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (probability * circumference);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
          <motion.circle
            cx="60" cy="60" r="54"
            stroke={colors.fill}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-3xl font-bold ${colors.text}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            {pct}%
          </motion.span>
          <span className="text-xs text-muted-foreground">Risk</span>
        </div>
      </div>
      <Badge className={`${colors.bg} ${colors.text} ${colors.border} border text-sm px-4 py-1`}>
        {riskLevel.toUpperCase()} RISK
      </Badge>
    </div>
  );
}

export default function Results() {
  const navigate = useNavigate();
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("heartguard_current");
    if (!raw) { navigate("/"); return; }
    setResult(JSON.parse(raw));
    const histRaw = sessionStorage.getItem("heartguard_history");
    if (histRaw) setHistory(JSON.parse(histRaw));
    getModelInfo().then(setModelInfo).catch(() => {});
  }, [navigate]);

  const loadHistoryEntry = (entry: HistoryEntry) => {
    setResult(entry.result);
    sessionStorage.setItem("heartguard_current", JSON.stringify(entry.result));
    setShowHistory(false);
  };

  const clearHistory = () => {
    sessionStorage.removeItem("heartguard_history");
    setHistory([]);
  };

  if (!result) return null;

  const riskColors = getRiskColor(result.risk_level);
  const ci = result.confidence_interval;

  const riskFactors = result.explanation?.top_risk_factors?.map((f) => ({
    name: getFeatureLabel(f.feature),
    value: Math.abs(f.contribution),
    rawValue: f.feature_value,
    unit: getFeatureUnit(f.feature),
    explanation: f.explanation,
    type: "risk" as const,
  })) || [];

  const protectiveFactors = result.explanation?.top_protective_factors?.map((f) => ({
    name: getFeatureLabel(f.feature),
    value: Math.abs(f.contribution),
    rawValue: f.feature_value,
    unit: getFeatureUnit(f.feature),
    explanation: f.explanation,
    type: "protective" as const,
  })) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <button onClick={() => navigate("/assess")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            New Assessment
          </button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" fill="currentColor" />
            <span className="font-semibold">HeartGuard</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="h-4 w-4 mr-1" />
            History
          </Button>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* History sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-72 border-r bg-card p-4 space-y-3 overflow-y-auto absolute md:relative z-40 h-full"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Session History</h3>
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {history.length === 0 && (
                <p className="text-xs text-muted-foreground">No history yet</p>
              )}
              {history.map((entry) => {
                const ec = getRiskColor(entry.risk_level);
                return (
                  <button
                    key={entry.id}
                    onClick={() => loadHistoryEntry(entry)}
                    className={`w-full text-left rounded-lg border p-3 space-y-1 hover:shadow-sm transition-shadow ${
                      entry.id === result.prediction_id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`${ec.text} ${ec.border} text-xs`}>
                        {entry.risk_level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(entry.risk_probability * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Age {entry.age}, {entry.sex === 0 ? "F" : "M"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                  </button>
                );
              })}
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearHistory} className="w-full text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear History
                </Button>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main results */}
        <main className="flex-1 container py-8 space-y-8 max-w-5xl">
          {/* Risk Gauge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center space-y-3"
          >
            <RiskGauge probability={result.risk_probability} riskLevel={result.risk_level} />
            {ci && (
              <p className="text-xs text-muted-foreground">
                Confidence interval: {Math.round(ci[0] * 100)}% – {Math.round(ci[1] * 100)}%
              </p>
            )}
          </motion.div>

          {/* Model info chip */}
          {modelInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center"
            >
              <div className="inline-flex items-center gap-3 rounded-full border bg-card px-4 py-2 text-xs text-muted-foreground">
                <span>Model: {modelInfo.model_name}</span>
                <span className="w-px h-3 bg-border" />
                <span>AUC: {modelInfo.metrics?.roc_auc?.toFixed(4) || "0.9407"}</span>
                <span className="w-px h-3 bg-border" />
                <span>v{modelInfo.model_version}</span>
              </div>
            </motion.div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel B: Risk Factors */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {result.explanation && (
                <>
                  {riskFactors.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4 text-red-500" />
                          Top Risk Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={riskFactors.length * 44 + 16}>
                          <BarChart data={riskFactors} layout="vertical" margin={{ left: 0, right: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={140}
                              tick={{ fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                              {riskFactors.map((_, i) => (
                                <Cell key={i} fill="#ef4444" fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {riskFactors.map((f) => (
                            <div key={f.name} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                              <span>
                                <strong>{f.name}</strong> ({f.rawValue}{f.unit ? ` ${f.unit}` : ""}): {f.explanation}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {protectiveFactors.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4 text-green-500" />
                          Protective Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={protectiveFactors.length * 44 + 16}>
                          <BarChart data={protectiveFactors} layout="vertical" margin={{ left: 0, right: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={140}
                              tick={{ fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                              {protectiveFactors.map((_, i) => (
                                <Cell key={i} fill="#22c55e" fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {protectiveFactors.map((f) => (
                            <div key={f.name} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                              <span>
                                <strong>{f.name}</strong> ({f.rawValue}{f.unit ? ` ${f.unit}` : ""}): {f.explanation}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!result.explanation && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    SHAP explanation not requested
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* Panel C: AI Explanation */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {result.llm_explanation ? (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        What This Means For You
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {result.llm_explanation.risk_explanation}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        Lifestyle Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.llm_explanation.lifestyle_recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-blue-500" />
                        Questions to Ask Your Doctor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.llm_explanation.doctor_consultation_questions.map((q, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                            {q}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    AI explanation not requested
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>

          {/* Bottom bar */}
          <div className="border-t pt-6 space-y-4">
            <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
              ⚕️ {MEDICAL_DISCLAIMER}
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate("/assess")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                New Assessment
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
