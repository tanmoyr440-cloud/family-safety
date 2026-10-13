import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { UserCheck, FileText, Edit2, Loader2, Check } from "lucide-react";
import { useNomineeGuidance, useUpdateNomineeGuidance } from "../api/useNomineeGuidance";

const DEFAULT_NOMINEE_NAME = "Savitri Sharma";
const DEFAULT_NOMINEE_RELATION = "Mother";
const DEFAULT_NOMINEE_SHARE = "100%";
const DEFAULT_NOTES =
  "Mutual fund investments are registered across AMCs and RTAs (CAMS & KFintech). In case of emergency, contact the respective fund houses or CAMS/KFintech with PAN, death certificate, and nominee claim forms. Folio details are listed in the emergency packet.";

export const NomineeNotesCard: React.FC = () => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  const { data, isLoading, isError } = useNomineeGuidance();
  const updateMutation = useUpdateNomineeGuidance();

  const [nomineeName, setNomineeName] = React.useState(DEFAULT_NOMINEE_NAME);
  const [nomineeRelation, setNomineeRelation] = React.useState(DEFAULT_NOMINEE_RELATION);
  const [nomineeShare, setNomineeShare] = React.useState(DEFAULT_NOMINEE_SHARE);
  const [notes, setNotes] = React.useState(DEFAULT_NOTES);

  React.useEffect(() => {
    if (data) {
      setNomineeName(data.nominee_name ?? DEFAULT_NOMINEE_NAME);
      setNomineeRelation(data.nominee_relation ?? DEFAULT_NOMINEE_RELATION);
      setNomineeShare(data.nominee_share ?? DEFAULT_NOMINEE_SHARE);
      setNotes(data.notes ?? DEFAULT_NOTES);
    }
  }, [data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateMutation.mutateAsync({
        nominee_name: nomineeName.trim(),
        nominee_relation: nomineeRelation.trim(),
        nominee_share: nomineeShare.trim(),
        notes: notes.trim(),
      });
      if (updated) {
        setNomineeName(updated.nominee_name ?? "");
        setNomineeRelation(updated.nominee_relation ?? "");
        setNomineeShare(updated.nominee_share ?? "");
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
      setNomineeName(data.nominee_name ?? DEFAULT_NOMINEE_NAME);
      setNomineeRelation(data.nominee_relation ?? DEFAULT_NOMINEE_RELATION);
      setNomineeShare(data.nominee_share ?? DEFAULT_NOMINEE_SHARE);
      setNotes(data.notes ?? DEFAULT_NOTES);
    } else {
      setNomineeName(DEFAULT_NOMINEE_NAME);
      setNomineeRelation(DEFAULT_NOMINEE_RELATION);
      setNomineeShare(DEFAULT_NOMINEE_SHARE);
      setNotes(DEFAULT_NOTES);
    }
    setIsEditing(false);
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-purple-600" aria-hidden="true" />
          <CardTitle className="text-base font-semibold text-slate-900">
            Nominee & Emergency Guidance Notes
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
            onClick={() => setIsEditing(true)}
            disabled={isLoading}
            className="text-slate-600 hover:text-slate-900"
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Edit Notes
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="nominee-name" className="block font-medium text-slate-700 mb-1">
                  Nominee Full Name
                </label>
                <input
                  id="nominee-name"
                  type="text"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="e.g. Savitri Sharma"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="nominee-rel" className="block font-medium text-slate-700 mb-1">
                  Relationship
                </label>
                <input
                  id="nominee-rel"
                  type="text"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  placeholder="e.g. Mother"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="nominee-share" className="block font-medium text-slate-700 mb-1">
                  Nomination Share (%)
                </label>
                <input
                  id="nominee-share"
                  type="text"
                  value={nomineeShare}
                  onChange={(e) => setNomineeShare(e.target.value)}
                  placeholder="e.g. 100%"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="emergency-notes" className="block font-medium text-slate-700 mb-1">
                Emergency Notes for Family
              </label>
              <textarea
                id="emergency-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Guidance on where folios are held, which RTAs to contact, etc."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {updateMutation.isError && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200" role="alert">
                Failed to save nominee guidance: {updateMutation.error instanceof Error ? updateMutation.error.message : "Please check your network connection and try again."}
              </p>
            )}

            <div className="flex justify-end gap-2">
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
                  "Save Notes"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-xs">
            {isError && (
              <div className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Notice: Default guidance template is shown. Customize your nominee instructions by clicking Edit Notes.
              </div>
            )}
            {/* Nominee details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Nominee Name</span>
                <span className="font-semibold text-slate-900">{nomineeName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Relationship</span>
                <span className="font-semibold text-slate-900">{nomineeRelation}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px] mb-0.5">Share</span>
                <span className="font-semibold text-slate-900">{nomineeShare}</span>
              </div>
            </div>

            {/* Emergency Guidance Notes */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                Emergency Instructions Included in Parent Packet
              </div>
              <p className="text-slate-600 leading-relaxed text-xs">{notes}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
