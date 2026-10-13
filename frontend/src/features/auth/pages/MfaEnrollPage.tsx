import * as React from "react";
import { useNavigate } from "react-router-dom";
import { MfaEnrollCard } from "../components/MfaEnrollCard";
import { Button } from "@/shared/ui/Button";
import { ArrowLeft } from "lucide-react";

export const MfaEnrollPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Security Settings</h1>
      </div>

      <MfaEnrollCard onEnrolled={() => {}} />
    </div>
  );
};
