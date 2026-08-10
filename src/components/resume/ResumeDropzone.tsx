import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, File, AlertCircle } from "lucide-react";

interface ResumeDropzoneProps {
  onFileSelect: (file: File) => void;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export function ResumeDropzone({ onFileSelect }: ResumeDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelectFile = (file: File) => {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Only PDF resumes are supported.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Resume must be 2MB or smaller.");
      return;
    }
    onFileSelect(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelectFile(e.target.files[0]);
    }
  }, []);

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/10" : "border-gray-300 hover:border-primary/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={inputRef}
          onChange={handleChange}
        />
        <div className="flex flex-col items-center justify-center space-y-2 text-gray-600">
          <UploadCloud size={32} className={isDragActive ? "text-primary" : "text-gray-400"} />
          <p className="text-sm font-medium">
            Drag & drop your resume here, or{" "}
            <span className="text-primary hover:underline">browse</span>
          </p>
          <p className="text-xs text-gray-400">PDF only (Max 2MB)</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center space-x-2 mt-2 text-sm text-red-500 bg-red-50 p-2 rounded">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
