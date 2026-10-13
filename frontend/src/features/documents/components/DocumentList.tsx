import * as React from "react";
import type { Document } from "../api/useDocuments";
import { Card, CardContent } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { formatDateIST } from "@/shared/lib/dates";
import { FileText, Trash2, Calendar, HardDrive } from "lucide-react";

export interface DocumentListProps {
  documents: Document[];
  onDelete: (doc: Document) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onDelete }) => {
  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card
          key={doc.id}
          className="border-slate-200 shadow-sm hover:border-slate-300 transition-colors overflow-hidden"
        >
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0 mt-0.5">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
                    {doc.category}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-500 break-all">{doc.filename}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" aria-hidden="true" />
                    {formatBytes(doc.size_bytes)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    {formatDateIST(doc.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(doc)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
