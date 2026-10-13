import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { UserCheck, FileText, Edit2, Check } from "lucide-react";

export const NomineeNotesCard: React.FC = () => {
  const [isEditing, setIsEditing] = React.useState(false);

  const [nomineeName, setNomineeName] = React.useState("Savitri Sharma");
  const [nomineeRelation, setNomineeRelation] = React.useState("Mother");
  const [nomineeShare, setNomineeShare] = React.useState("100%");
  const [notes, setNotes] = React.useState(
    "Mutual fund investments are registered across AMCs and RTAs (CAMS & KFintech). In case of emergency, contact the respective fund houses or CAMS/KFintech with PAN, death certificate, and nominee claim forms. Folio details are listed in the emergency packet.",
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="text-slate-600"
        >
          {isEditing ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Done
            </>
          ) : (
            <>
              <Edit2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Edit Notes
            </>
          )}
        </Button>
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save Notes
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-xs">
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
