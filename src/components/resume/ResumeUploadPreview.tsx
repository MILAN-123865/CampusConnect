import React from "react";
import { FileText, X, CheckCircle } from "lucide-react";

interface ResumeUploadPreviewProps {
  file: File;
  onRemove: () => void;
  progress?: number;
  isUploaded?: boolean;
}

export function ResumeUploadPreview({
  file,
  onRemove,
  progress = 0,
  isUploaded = false,
}: ResumeUploadPreviewProps) {
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

  return (
    <div className="w-full border rounded-lg p-4 bg-gray-50 flex items-center justify-between">
      <div className="flex items-center space-x-3 overflow-hidden">
        <div className="flex-shrink-0 bg-white p-2 rounded shadow-sm">
          <FileText size={24} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">{sizeMb} MB</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {!isUploaded && progress > 0 && progress < 100 && (
          <div className="w-24 bg-gray-200 rounded-full h-2.5">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        )}

        {isUploaded && (
          <div className="text-green-500 flex items-center text-xs space-x-1">
            <CheckCircle size={16} />
            <span>Uploaded</span>
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
          title="Remove resume"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
