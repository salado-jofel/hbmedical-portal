import { AlertCircle } from "lucide-react";

export default function ErrorAlert({ errorMessage }: { errorMessage: string }) {
  return (
    <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in zoom-in-95">
      <AlertCircle className="w-4 h-4" />
      <p>{errorMessage}</p>
    </div>
  );
}
