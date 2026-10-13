import * as React from "react";
import { useContacts, type Contact } from "../api/useContacts";
import { useDeleteContact } from "../api/useDeleteContact";
import { ContactCard } from "../components/ContactCard";
import { ContactForm } from "../components/ContactForm";
import { RemoveContactDialog } from "../components/RemoveContactDialog";
import { Button } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/Skeleton";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Card, CardContent } from "@/shared/ui/Card";
import { AlertCircle, AlertTriangle, Plus, RefreshCw, Users } from "lucide-react";

export const ContactsPage: React.FC = () => {
  const { data: contacts, isLoading, error, refetch, isFetching } = useContacts();
  const { mutate: deleteContact, isPending: isDeleting } = useDeleteContact();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null);

  const [contactToRemove, setContactToRemove] = React.useState<Contact | null>(null);
  const [isRemoveOpen, setIsRemoveOpen] = React.useState(false);

  const verifiedCount = (contacts || []).filter((c) => c.consent === "VERIFIED").length;

  const handleOpenAdd = () => {
    setEditingContact(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleOpenRemove = (contact: Contact) => {
    setContactToRemove(contact);
    setIsRemoveOpen(true);
  };

  const handleConfirmRemove = () => {
    if (!contactToRemove) return;
    deleteContact(contactToRemove.id, {
      onSuccess: () => {
        setIsRemoveOpen(false);
        setContactToRemove(null);
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" aria-hidden="true" />
            Trusted Contacts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            People who will be alerted by SMS and email if your investment activity stops or an EMI
            is missed.
          </p>
        </div>

        <Button onClick={handleOpenAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Add Contact
        </Button>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-4" aria-label="Loading contacts">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      )}

      {/* Error State with Retry */}
      {!isLoading && error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-red-900">
                  Unable to load trusted contacts
                </h2>
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
      {!isLoading && !error && (!contacts || contacts.length === 0) && (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No trusted contacts yet"
          description="Add your parents, spouse, or family members. We will only contact them if we cannot verify your activity for 90 days or if your loan EMI is missed."
          action={
            <Button onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Add your first contact
            </Button>
          }
        />
      )}

      {/* Success State with Contacts */}
      {!isLoading && !error && contacts && contacts.length > 0 && (
        <div className="space-y-5">
          {/* Attention Banner if 0 verified contacts */}
          {verifiedCount === 0 && (
            <div
              role="alert"
              className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900"
            >
              <AlertTriangle
                className="h-5 w-5 text-amber-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-amber-950">No verified emergency contacts</p>
                <p className="leading-relaxed">
                  Your contacts have not verified consent yet. Emergency alerts will only be
                  delivered to contacts once they enter their verification OTP.
                </p>
              </div>
            </div>
          )}

          {/* List of Contacts */}
          <div className="space-y-4">
            {contacts
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={handleOpenEdit}
                  onRemove={handleOpenRemove}
                />
              ))}
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal Dialog */}
      <ContactForm
        contact={editingContact}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingContact(null);
        }}
      />

      {/* Remove Contact Warning Dialog */}
      <RemoveContactDialog
        contact={contactToRemove}
        isOpen={isRemoveOpen}
        onClose={() => {
          setIsRemoveOpen(false);
          setContactToRemove(null);
        }}
        onConfirm={handleConfirmRemove}
        isRemoving={isDeleting}
        totalVerifiedContacts={verifiedCount}
      />
    </div>
  );
};
