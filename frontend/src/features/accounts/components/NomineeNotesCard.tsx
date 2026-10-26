import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import {
  UserCheck,
  FileText,
  Edit2,
  Loader2,
  Check,
  Plus,
  Trash2,
  Users,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  useNomineeGuidance,
  useUpdateNomineeGuidance,
  type NomineeItem,
} from "../api/useNomineeGuidance";

interface EditableNominee {
  id: string;
  name: string;
  relation: string;
  share: string;
}

export const NomineeNotesCard: React.FC = () => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const { data, isLoading, isError } = useNomineeGuidance();
  const updateMutation = useUpdateNomineeGuidance();

  const [nominees, setNominees] = React.useState<EditableNominee[]>([]);
  const [notes, setNotes] = React.useState("");

  // Sync state when data loads or changes
  React.useEffect(() => {
    if (data) {
      if (data.nominees && data.nominees.length > 0) {
        setNominees(
          data.nominees.map((n, i) => ({
            id: `nominee-${i}-${Date.now()}`,
            name: n.name ?? "",
            relation: n.relation ?? "",
            share: n.share ?? "100%",
          })),
        );
      } else if (data.nominee_name) {
        setNominees([
          {
            id: `nominee-0-${Date.now()}`,
            name: data.nominee_name,
            relation: data.nominee_relation ?? "",
            share: data.nominee_share ?? "100%",
          },
        ]);
      } else {
        setNominees([]);
      }
      setNotes(data.notes ?? "");
    }
  }, [data]);

  const handleAddNominee = () => {
    setNominees((prev) => [
      ...prev,
      {
        id: `nominee-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: "",
        relation: "",
        share: prev.length === 0 ? "100%" : "50%",
      },
    ]);
  };

  const handleRemoveNominee = (id: string) => {
    setNominees((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNomineeChange = (
    id: string,
    field: "name" | "relation" | "share",
    value: string,
  ) => {
    setNominees((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Filter out empty rows
      const validNominees: NomineeItem[] = nominees
        .map((n) => ({
          name: n.name.trim(),
          relation: n.relation.trim(),
          share: n.share.trim() || "100%",
        }))
        .filter((n) => n.name.length > 0);

      const updated = await updateMutation.mutateAsync({
        nominees: validNominees,
        nominee_name: validNominees[0]?.name ?? null,
        nominee_relation: validNominees[0]?.relation ?? null,
        nominee_share: validNominees[0]?.share ?? null,
        notes: notes.trim() || null,
      });

      if (updated) {
        if (updated.nominees && updated.nominees.length > 0) {
          setNominees(
            updated.nominees.map((n, i) => ({
              id: `nominee-${i}-${Date.now()}`,
              name: n.name ?? "",
              relation: n.relation ?? "",
              share: n.share ?? "100%",
            })),
          );
        } else {
          setNominees([]);
        }
        setNotes(updated.notes ?? "");
      }
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Mutation error state will display error message
    }
  };

  const handleCancel = () => {
    if (data) {
      if (data.nominees && data.nominees.length > 0) {
        setNominees(
          data.nominees.map((n, i) => ({
            id: `nominee-${i}-${Date.now()}`,
            name: n.name ?? "",
            relation: n.relation ?? "",
            share: n.share ?? "100%",
          })),
        );
      } else if (data.nominee_name) {
        setNominees([
          {
            id: `nominee-0-${Date.now()}`,
            name: data.nominee_name,
            relation: data.nominee_relation ?? "",
            share: data.nominee_share ?? "100%",
          },
        ]);
      } else {
        setNominees([]);
      }
      setNotes(data.notes ?? "");
    } else {
      setNominees([]);
      setNotes("");
    }
    setIsEditing(false);
  };

  const activeNominees = data?.nominees && data.nominees.length > 0
    ? data.nominees
    : data?.nominee_name
      ? [{ name: data.nominee_name, relation: data.nominee_relation ?? "", share: data.nominee_share ?? "100%" }]
      : [];

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-purple-600" aria-hidden="true" />
          <CardTitle className="text-base font-semibold text-slate-900">
            Nominee &amp; Emergency Guidance Notes
          </CardTitle>
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </span>
          )}
        </div>

        {!isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (nominees.length === 0) {
                handleAddNominee();
              }
              setIsEditing(true);
            }}
            disabled={isLoading}
            className="text-slate-600 hover:text-slate-900"
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            {activeNominees.length > 0 ? "Edit Details" : "Add Nominees"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            {/* Nominees list editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-600" aria-hidden="true" />
                  Registered Nominees
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddNominee}
                  className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <Plus className="h-3 w-3" />
                  Add Nominee
                </Button>
              </div>

              {nominees.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center space-y-2 bg-slate-50">
                  <p className="text-slate-500 text-xs">No nominees added yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddNominee}
                    className="h-8 text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add First Nominee
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {nominees.map((nominee, idx) => (
                    <div
                      key={nominee.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end p-3 rounded-xl bg-purple-50/40 border border-purple-100"
                    >
                      <div className="sm:col-span-5">
                        <label
                          htmlFor={`nominee-name-${nominee.id}`}
                          className="block font-medium text-slate-700 mb-1 text-[11px]"
                        >
                          Nominee {idx + 1} Full Name
                        </label>
                        <input
                          id={`nominee-name-${nominee.id}`}
                          type="text"
                          value={nominee.name}
                          onChange={(e) =>
                            handleNomineeChange(nominee.id, "name", e.target.value)
                          }
                          placeholder="e.g. Legal Full Name"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label
                          htmlFor={`nominee-rel-${nominee.id}`}
                          className="block font-medium text-slate-700 mb-1 text-[11px]"
                        >
                          Relationship
                        </label>
                        <input
                          id={`nominee-rel-${nominee.id}`}
                          type="text"
                          value={nominee.relation}
                          onChange={(e) =>
                            handleNomineeChange(nominee.id, "relation", e.target.value)
                          }
                          placeholder="e.g. Mother, Father, Spouse"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`nominee-share-${nominee.id}`}
                          className="block font-medium text-slate-700 mb-1 text-[11px]"
                        >
                          Share (%)
                        </label>
                        <input
                          id={`nominee-share-${nominee.id}`}
                          type="text"
                          value={nominee.share}
                          onChange={(e) =>
                            handleNomineeChange(nominee.id, "share", e.target.value)
                          }
                          placeholder="e.g. 100% or 50%"
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveNominee(nominee.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Remove Nominee"
                          aria-label={`Remove nominee ${nominee.name || idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Emergency Notes section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="emergency-notes" className="block font-medium text-slate-700">
                  Emergency Instructions Included in Parent Packet
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setNotes(
                      "বাবা/মা: কোনো চিন্তা করবেন না। সমস্ত মিউচুয়াল ফান্ড ও শেয়ার CAMS এবং KFintech-এ সম্পূর্ণ সুরক্ষিত আছে। গাড়ির লোনের জন্য প্রতি মাসের ২৪ তারিখে নিকটবর্তী HDFC ব্যাংক শাখায় নিচের লোন অ্যাকাউন্ট নম্বর দিয়ে ₹১৬,১৬৬ কিস্তি জমা দিয়ে রসিদ রাখবেন।\n\nMaa/Papa: Don't worry. All mutual funds and stocks are safe with CAMS & KFintech. For the car loan, please pay the ₹16,166 EMI due on the 24th at the nearest HDFC Bank branch using the loan account number below and keep the stamped receipt safe.",
                    )
                  }
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-medium hover:underline"
                >
                  + Use Simple Parent Guidance Template
                </button>
              </div>
              <textarea
                id="emergency-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Guidance on where folios are held, RTAs to contact (CAMS/KFintech), claim steps, etc."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                These instructions will be presented to your emergency contacts if safety alerts are triggered.
              </p>
            </div>

            {updateMutation.isError && (
              <div
                className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>
                  Failed to save nominee guidance:{" "}
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : "Please check your connection and try again."}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  "Save Nominees & Guidance"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            {isError && (
              <div className="flex items-center gap-2 text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>Unable to load nominee guidance. Please refresh to try again.</span>
              </div>
            )}

            {/* Nominees section */}
            {activeNominees.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-1.5">
                <Users className="h-5 w-5 text-slate-400 mx-auto" />
                <p className="font-medium text-slate-700">No nominees registered yet</p>
                <p className="text-slate-500 text-[11px] max-w-sm mx-auto">
                  Add your nominee details so your family knows who is entitled to claim your mutual funds and stocks.
                </p>
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleAddNominee();
                      setIsEditing(true);
                    }}
                    className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Plus className="h-3 w-3" />
                    Add Nominee
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    Registered Nominees ({activeNominees.length})
                  </span>
                </div>
                <div className="divide-y divide-purple-100 rounded-xl border border-purple-100 bg-purple-50/30 overflow-hidden">
                  {activeNominees.map((nom, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 sm:px-4"
                    >
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Nominee Name</span>
                        <span className="font-semibold text-slate-900">{nom.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Relationship</span>
                        <span className="font-medium text-slate-800">{nom.relation || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Share</span>
                        <span className="font-semibold text-purple-700">{nom.share || "100%"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Guidance Notes */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Emergency Instructions Included in Parent Packet
              </div>
              {data?.notes ? (
                <p className="text-slate-700 leading-relaxed text-xs whitespace-pre-line">
                  {data.notes}
                </p>
              ) : (
                <p className="text-slate-400 italic text-[11px]">
                  No custom emergency instructions added yet. Click &ldquo;Edit Details&rdquo; above to add guidance for your emergency contacts.
                </p>
              )}
            </div>

            {/* Parent Awareness & Guidance Preview */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-blue-950 text-xs">
                  <HelpCircle className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  Parent Awareness &amp; Step-by-Step Guidance (বাবা-মা ও পরিবারের জন্য সহজ নির্দেশিকা)
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  বাংলা &amp; English Included
                </span>
              </div>
              <p className="text-[11px] text-blue-900/80 leading-relaxed">
                Emergency packets and contact alerts automatically feature simple, jargon-free step-by-step guidance in Bengali (বাংলা) &amp; English explaining how to claim mutual funds via CAMS/KFintech, how to pay the ₹16,166 car loan EMI at the branch, and security rules against phone fraud.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
