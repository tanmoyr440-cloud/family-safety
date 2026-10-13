import * as React from "react";
import { useDocuments, type Document } from "../api/useDocuments";
import { useDeleteDocument } from "../api/useDeleteDocument";
import { DocumentUploadZone } from "../components/DocumentUploadZone";
import { DocumentList } from "../components/DocumentList";
import { DeleteDocumentDialog } from "../components/DeleteDocumentDialog";
import { Skeleton } from "@/shared/ui/Skeleton";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Card, CardContent } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { AlertCircle, FileText, Files, RefreshCw } from "lucide-react";

export const DocumentsPage: React.FC = () => {
  const { data: documents, isLoading, error, refetch, isFetching } = useDocuments();
  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteDocument();

  const [documentToDelete, setDocumentToDelete] = React.useState<Document | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const handleOpenDelete = (doc: Document) => {
    setDocumentToDelete(doc);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!documentToDelete) return;
    deleteDocument(documentToDelete.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDocumentToDelete(null);
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Files className="h-6 w-6 text-blue-600" aria-hidden="true" />
          Encrypted Emergency Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Store insurance policies, loan papers, and identity proofs. Files are envelope-encrypted
          and shared with family only in the secure emergency packet.
        </p>
      </div>

      {/* Upload Zone */}
      <DocumentUploadZone onSuccess={() => refetch()} />

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-3" aria-label="Loading documents">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoading && error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-red-900">Unable to load documents</h2>
                <p className="text-sm text-red-700">
                  {error.message || "A network or server error occurred. Please try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="mt-2 border-red-200 text-red-800 hover:bg-red-100"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!documents || documents.length === 0) && (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No emergency documents uploaded"
          description="Upload copies of your car loan sanction letter, term insurance policy, or nominee identification. They will be decrypted only for verified parents during an emergency."
        />
      )}

      {/* Documents List */}
      {!isLoading && !error && documents && documents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Uploaded Documents ({documents.length})
            </h2>
          </div>
          <DocumentList documents={documents} onDelete={handleOpenDelete} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteDocumentDialog
        document={documentToDelete}
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDocumentToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
