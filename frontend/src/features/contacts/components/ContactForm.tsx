import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { contactFormSchema, type ContactFormData } from "../schemas/contactSchemas";
import type { Contact } from "../api/useContacts";
import { useCreateContact } from "../api/useCreateContact";
import { useUpdateContact } from "../api/useUpdateContact";
import { Button } from "@/shared/ui/Button";
import { ApiError } from "@/shared/api/errors";
import { AlertCircle, UserPlus, X } from "lucide-react";

export interface ContactFormProps {
  contact?: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RELATION_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "spouse", label: "Spouse" },
  { value: "sibling", label: "Brother / Sister" },
  { value: "child", label: "Son / Daughter" },
  { value: "friend", label: "Trusted Friend" },
  { value: "lawyer", label: "Legal Advisor / Lawyer" },
  { value: "other", label: "Other" },
];

const LOCALE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिंदी)" },
  { value: "bn", label: "Bengali (বাংলা)" },
  { value: "mr", label: "Marathi (मराठी)" },
  { value: "ta", label: "Tamil (தமிழ்)" },
  { value: "te", label: "Telugu (తెలుగు)" },
];

export const ContactForm: React.FC<ContactFormProps> = ({
  contact,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(contact);
  const {
    mutate: createContact,
    isPending: isCreatePending,
    error: createError,
  } = useCreateContact();
  const {
    mutate: updateContact,
    isPending: isUpdatePending,
    error: updateError,
  } = useUpdateContact();
  const isPending = isCreatePending || isUpdatePending;
  const submitError = createError || updateError;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name || "",
      relation: contact?.relation || "father",
      phone: contact?.phone || "",
      email: contact?.email || "",
      priority: contact?.priority ?? 1,
      locale: "en",
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset({
        name: contact?.name || "",
        relation: contact?.relation || "father",
        phone: contact?.phone || "",
        email: contact?.email || "",
        priority: contact?.priority ?? 1,
        locale: "en",
      });
    }
  }, [isOpen, contact, reset]);

  const handleServerError = (err: unknown) => {
    if (err instanceof ApiError && err.fieldErrors) {
      for (const item of err.fieldErrors) {
        if (item.field in contactFormSchema.shape) {
          setError(item.field as keyof ContactFormData, {
            type: "server",
            message: item.message,
          });
        }
      }
    }
  };

  const onSubmit = (values: ContactFormData) => {
    if (isEditing && contact) {
      updateContact(
        {
          id: contact.id,
          data: {
            name: values.name,
            relation: values.relation,
            phone: values.phone,
            email: values.email,
            priority: values.priority,
            locale: values.locale,
          },
        },
        {
          onSuccess: () => {
            onClose();
            onSuccess?.();
          },
          onError: handleServerError,
        },
      );
    } else {
      createContact(
        {
          name: values.name,
          relation: values.relation,
          phone: values.phone,
          email: values.email,
          priority: values.priority,
          locale: values.locale,
        },
        {
          onSuccess: () => {
            onClose();
            onSuccess?.();
          },
          onError: handleServerError,
        },
      );
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-xl duration-200 sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-slate-900">
                {isEditing ? "Edit Trusted Contact" : "Add Trusted Contact"}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="text-xs text-muted-foreground">
            We will only contact this person if your investment activity stops or an EMI is missed.
            New contacts must verify their consent via OTP.
          </DialogPrimitive.Description>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2" noValidate>
            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{submitError.message || "Failed to save contact. Please review the details."}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="contact-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="contact-name"
                type="text"
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? "border-red-500 bg-red-50/20" : "border-slate-300"
                }`}
                placeholder="e.g. Ramesh Sharma"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "contact-name-error" : undefined}
                {...register("name")}
              />
              {errors.name && (
                <p id="contact-name-error" className="mt-1 text-xs text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="contact-relation"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Relationship
              </label>
              <select
                id="contact-relation"
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.relation ? "border-red-500 bg-red-50/20" : "border-slate-300"
                }`}
                aria-invalid={Boolean(errors.relation)}
                aria-describedby={errors.relation ? "contact-relation-error" : undefined}
                {...register("relation")}
              >
                {RELATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.relation && (
                <p id="contact-relation-error" className="mt-1 text-xs text-red-600">
                  {errors.relation.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="contact-phone"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Mobile Phone Number
                </label>
                <span className="text-[11px] text-muted-foreground">India default (+91)</span>
              </div>
              <input
                id="contact-phone"
                type="tel"
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phone ? "border-red-500 bg-red-50/20" : "border-slate-300"
                }`}
                placeholder="+91 98765 43210 or 10-digit number"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "contact-phone-error" : "contact-phone-hint"}
                {...register("phone")}
              />
              {errors.phone ? (
                <p id="contact-phone-error" className="mt-1 text-xs text-red-600">
                  {errors.phone.message}
                </p>
              ) : (
                <p id="contact-phone-hint" className="mt-1 text-[11px] text-muted-foreground">
                  Consent OTP and SMS emergency notifications will be sent to this number.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="contact-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? "border-red-500 bg-red-50/20" : "border-slate-300"
                }`}
                placeholder="parent@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "contact-email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="contact-email-error" className="mt-1 text-xs text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="contact-priority"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Notification Order
                </label>
                <input
                  id="contact-priority"
                  type="number"
                  min="1"
                  max="10"
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.priority ? "border-red-500 bg-red-50/20" : "border-slate-300"
                  }`}
                  aria-invalid={Boolean(errors.priority)}
                  aria-describedby={errors.priority ? "contact-priority-error" : undefined}
                  {...register("priority", { valueAsNumber: true })}
                />
                {errors.priority && (
                  <p id="contact-priority-error" className="mt-1 text-xs text-red-600">
                    {errors.priority.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="contact-locale"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Preferred Language
                </label>
                <select
                  id="contact-locale"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  {...register("locale")}
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isPending}>
                {isEditing ? "Save Changes" : "Add Contact"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
