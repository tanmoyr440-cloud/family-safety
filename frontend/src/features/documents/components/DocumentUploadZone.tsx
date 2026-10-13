import * as React from "react";
import { useUploadDocument } from "../api/useUploadDocument";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";
import { AlertCircle, FileUp, Lock, UploadCloud, X } from "lucide-react";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];

const CATEGORY_OPTIONS = [
  { value: "financial", label: "Financial / Investment" },
  { value: "identity", label: "Identity & Aadhaar / PAN" },
  { value: "insurance", label: "Insurance Policy" },
  { value: "legal", label: "Legal / Will" },
  { value: "general", label: "General" },
];

export interface DocumentUploadZoneProps {
  onSuccess?: () => void;
}

export const DocumentUploadZone: React.FC<DocumentUploadZoneProps> = ({ onSuccess }) => {
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("financial");
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const {
    mutate: uploadDocument,
    isPending: isUploading,
    error: serverError,
    reset: resetMutation,
  } = useUploadDocument();

  const validateFile = (file: File): boolean => {
    setFileError(null);
    resetMutation();

    if (file.size === 0) {
      setFileError("Uploaded file cannot be empty.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size exceeds 15 MB limit.");
      return false;
    }

    const isPdfFilename = file.name.toLowerCase().endsWith(".pdf");
    if (!ALLOWED_TYPES.includes(file.type) && !isPdfFilename) {
      setFileError("Unsupported file type. Only PDF, PNG, and JPEG documents are permitted.");
      return false;
    }

    return true;
  };

  const handleFileSelection = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      // Auto-suggest title based on filename
      const rawName = file.name.replace(/\.[^/.]+$/, "");
      const cleanedTitle = rawName.replace(/[-_]/g, " ").trim();
      setTitle(cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1));
    } else {
      setSelectedFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFileError("Please choose a file to upload.");
      return;
    }

    if (!title.trim()) {
      setFileError("Please enter a document title.");
      return;
    }

    setUploadProgress(10);

    uploadDocument(
      {
        file: selectedFile,
        title: title.trim(),
        category,
        onProgress: (p) => setUploadProgress(p),
      },
      {
        onSuccess: () => {
          setSelectedFile(null);
          setTitle("");
          setUploadProgress(null);
          setFileError(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          onSuccess?.();
        },
        onError: () => {
          setUploadProgress(null);
        },
      },
    );
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Upload Emergency Document</h2>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Lock className="h-3 w-3" aria-hidden="true" />
            Envelope Encrypted
          </span>
        </div>

        {/* Stated Limits Box */}
        <div className="text-xs text-slate-600 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-1">
          <p className="font-semibold text-slate-800">Stated Upload Limits:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
            <li>Accepted types: PDF, PNG, JPEG</li>
            <li>Maximum file size: 15 MB</li>
            <li>Encrypted with AES-256-GCM envelope encryption at rest</li>
          </ul>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Choose document file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileSelection(e.target.files[0]);
            }
          }}
        />

        {/* Drag and Drop Zone */}
        {!selectedFile ? (
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
              dragActive
                ? "border-blue-500 bg-blue-50/40"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-50 text-blue-600 mb-3">
              <UploadCloud className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Drag and drop your file here, or browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports car loan papers, insurance policies, PAN/Aadhaar copies, and will documents
            </p>
          </div>
        ) : (
          /* File Selected Form */
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5 truncate">
                <FileUp className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="doc-title"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Document Title
                </label>
                <input
                  id="doc-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Car Loan Agreement"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="doc-category"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Category
                </label>
                <select
                  id="doc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Progress bar */}
            {isUploading && uploadProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Uploading and encrypting...</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isUploading}>
                Upload Document
              </Button>
            </div>
          </form>
        )}

        {/* Per-file validation error display */}
        {fileError && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{fileError}</p>
          </div>
        )}

        {/* Server error display */}
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{serverError.message || "Failed to upload document. Please try again."}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
