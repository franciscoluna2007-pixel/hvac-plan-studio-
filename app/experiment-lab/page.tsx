import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperimentLab } from "./ExperimentLab";
import "./experiment-lab.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Experiment Lab",
  description: "An opt-in isolated comparison surface for HVAC Plan Studio geometry experiments.",
};

export default function ExperimentLabPage() {
  if (process.env.NEXT_PUBLIC_EXPERIMENT_LAB_ENABLED !== "1") {
    notFound();
  }

  return <ExperimentLab />;
}
