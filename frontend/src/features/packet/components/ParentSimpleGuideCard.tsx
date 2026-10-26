import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/Card";
import { cn } from "@/shared/lib/utils";
import {
  AlertOctagon,
  Car,
  CheckCircle2,
  HelpCircle,
  Landmark,
  Languages,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export interface ParentSimpleGuideCardProps {
  ownerName: string;
  loans?: Array<{
    lender?: string;
    account_number?: string | null;
    account_masked?: string;
    emi_paise?: number;
    due_day?: number;
    payment_instructions?: {
      upi_id?: string | null;
      portal_url?: string | null;
    } | null;
  }>;
}

type Language = "en" | "hi";
type ActiveTab = "mf" | "loan" | "bank" | "rules";

export const ParentSimpleGuideCard: React.FC<ParentSimpleGuideCardProps> = ({
  ownerName,
  loans = [],
}) => {
  const [lang, setLang] = React.useState<Language>("hi");
  const [tab, setTab] = React.useState<ActiveTab>("mf");

  const primaryLoan = loans[0];
  const loanLender = primaryLoan?.lender || "HDFC Bank";
  const loanAccount =
    primaryLoan?.account_number || primaryLoan?.account_masked || "Recorded with lender";
  const loanEmiFormatted = primaryLoan?.emi_paise
    ? `₹${(primaryLoan.emi_paise / 100).toLocaleString("en-IN")}`
    : "₹16,166";
  const loanDueDay = primaryLoan?.due_day ? `${primaryLoan.due_day}th` : "24th";
  const loanUpi = primaryLoan?.payment_instructions?.upi_id || "carloan@hdfc";

  const isHindi = lang === "hi";

  return (
    <Card className="page-break-avoid border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                {isHindi ? "आसान भाषा में निर्देश" : "Simple Family Guide"}
              </span>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-0.5">
              {isHindi
                ? "माता-पिता और परिवार के लिए सरल मार्गदर्शिका"
                : `Step-by-Step Guidance for ${ownerName}'s Parents`}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isHindi
                ? "बिना किसी परेशानी के पैसे क्लेम करने और लोन EMI भरने के आसान नियम"
                : "Simple, jargon-free instructions on how to handle investments, loans, and bank accounts"}
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
          <Languages className="h-3.5 w-3.5 text-slate-500 ml-1.5 mr-0.5" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all",
              isHindi
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900",
            )}
            aria-pressed={isHindi}
          >
            हिंदी (Hindi)
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all",
              !isHindi
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900",
            )}
            aria-pressed={!isHindi}
          >
            English (Simple)
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Parent Guidance Topics"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mf"}
            onClick={() => setTab("mf")}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left",
              tab === "mf"
                ? "bg-white border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20"
                : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300",
            )}
          >
            <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <div className="leading-tight">
              <span className="block">{isHindi ? "म्यूचुअल फंड / शेयर" : "Mutual Funds & Stocks"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isHindi ? "पैसे कैसे मिलेंगे" : "How to claim"}
              </span>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "loan"}
            onClick={() => setTab("loan")}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left",
              tab === "loan"
                ? "bg-white border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20"
                : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300",
            )}
          >
            <Car className="h-4 w-4 text-rose-600 shrink-0" aria-hidden="true" />
            <div className="leading-tight">
              <span className="block">{isHindi ? "कार लोन EMI" : "Car Loan EMI"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isHindi ? "क़िस्त कैसे भरें" : "How to pay"}
              </span>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "bank"}
            onClick={() => setTab("bank")}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left",
              tab === "bank"
                ? "bg-white border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20"
                : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300",
            )}
          >
            <Landmark className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
            <div className="leading-tight">
              <span className="block">{isHindi ? "बैंक खाते" : "Bank Accounts"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isHindi ? "रक़म कैसे लें" : "Nominee claim"}
              </span>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === "rules"}
            onClick={() => setTab("rules")}
            className={cn(
              "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all text-left",
              tab === "rules"
                ? "bg-white border-amber-500 text-amber-950 shadow-xs ring-1 ring-amber-500/20"
                : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300",
            )}
          >
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
            <div className="leading-tight">
              <span className="block">{isHindi ? "ज़रूरी सावधानियाँ" : "Safety Rules"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isHindi ? "क्या कभी न करें" : "What to avoid"}
              </span>
            </div>
          </button>
        </div>

        {/* Tab 1: Mutual Funds & Stocks Guidance */}
        {tab === "mf" && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 text-xs text-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  {isHindi
                    ? "म्यूचुअल फंड और शेयर के पैसे प्राप्त करने का आसान तरीक़ा"
                    : "How to Claim & Redeem Mutual Funds & Stocks"}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {isHindi
                    ? "यह पैसा सरकारी संस्थाओं (CAMS / KFintech) के पास सुरक्षित है। इसे सीधे नॉमिनी के खाते में पाने के 4 आसान क़दम:"
                    : "Investments are safely recorded with regulated registries (CAMS / KFintech). Here are 4 clear steps:"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {isHindi ? "काग़ज़ात इकट्ठा करें (Documents to gather)" : "Step 1: Gather 4 simple documents"}
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-700 pl-7 list-disc">
                  <li>
                    {isHindi
                      ? "नॉमिनी (माता/पिता) का आधार कार्ड और पैन कार्ड"
                      : "Nominee's Aadhaar Card & PAN Card"}
                  </li>
                  <li>
                    {isHindi
                      ? "नॉमिनी के बैंक खाते का कैंसिल्ड चेक या पासबुक (जिसमें पैसा आना है)"
                      : "Nominee's bank passbook or cancelled cheque (for direct transfer)"}
                  </li>
                  <li>
                    {isHindi
                      ? "फ़ोलियो नंबर (Folio Numbers — नीचे दी गई तालिका में लिखे हैं)"
                      : "Folio numbers listed in the table below"}
                  </li>
                  <li>
                    {isHindi
                      ? "आधिकारिक मृत्यु प्रमाण पत्र (यदि खाताधारक का निधन हो गया हो)"
                      : "Official Death Certificate (in unfortunate event of bereavement)"}
                  </li>
                </ul>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {isHindi ? "कहाँ जाना है (Where to contact)" : "Step 2: Visit nearest registry or call"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 pl-7 space-y-1 leading-relaxed">
                  <p>
                    {isHindi
                      ? "अपने शहर में नज़दीकी CAMS या KFintech के आधिकारिक दफ़्तर जाएँ। यह हर ज़िले में उपलब्ध होते हैं।"
                      : "Visit the nearest CAMS or KFintech branch office in your city or call official helplines:"}
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1.5 font-mono text-[10px]">
                    <span className="bg-white border px-2 py-0.5 rounded font-semibold text-slate-800">
                      CAMS: 1800-419-2267
                    </span>
                    <span className="bg-white border px-2 py-0.5 rounded font-semibold text-slate-800">
                      KFintech: 1800-309-4001
                    </span>
                    <span className="bg-white border px-2 py-0.5 rounded font-semibold text-slate-800">
                      Groww: 080-68249147
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {isHindi ? "शाखा में क्या बोलना है (What to say)" : "Step 3: What to ask the officer"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 pl-7 italic bg-white p-2 rounded-lg border border-slate-200">
                  {isHindi
                    ? `“मेरे बेटे/बेटी (${ownerName}) के म्यूचुअल फंड इस फ़ोलियो में हैं। मैं नॉमिनी हूँ, कृपया मुझे 'नॉमिनी ट्रांसमिशन फ़ॉर्म' (Nominee Claim Form) दीजिए।”`
                    : `“I am the registered nominee for ${ownerName}'s mutual fund folio. Please provide the official Transmission / Claim form.”`}
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span className="font-bold text-emerald-950 text-xs">
                    {isHindi ? "पैसे कैसे और कब मिलेंगे" : "Step 4: Direct deposit to your account"}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-900 pl-7 space-y-1">
                  <p>
                    {isHindi
                      ? "फ़ॉर्म जमा करने के 7 से 15 दिनों में पूरा पैसा सीधे नॉमिनी के बैंक खाते में RTGS/NEFT से आ जाता है।"
                      : "Within 7 to 15 working days, AMCs transfer funds directly into the nominee's verified bank account."}
                  </p>
                  <p className="font-semibold text-[10px] text-emerald-800">
                    {isHindi
                      ? "✓ यह प्रक्रिया पूरी तरह मुफ़्त है। किसी भी एजेंट या बिचौलिए को एक भी रुपया न दें।"
                      : "✓ This is an official free government-regulated procedure. Never pay commissions to agents."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Car Loan Guidance */}
        {tab === "loan" && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 text-xs text-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Car className="h-4 w-4 text-rose-600" />
                  {isHindi
                    ? "कार लोन की क़िस्त (EMI) कैसे और कब भरें"
                    : "How to Pay the Monthly Car Loan EMI"}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {isHindi
                    ? "गाड़ी पर लेट फ़ीस या पेनल्टी से बचने के लिए समय पर क़िस्त भरने का तरीक़ा:"
                    : "Prevent late payment penalties or repossession with these simple steps:"}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-center gap-3">
                <div>
                  <span className="text-[10px] text-rose-700 block uppercase font-semibold">
                    {isHindi ? "मासिक क़िस्त" : "Monthly EMI"}
                  </span>
                  <span className="text-sm font-bold font-mono">{loanEmiFormatted}</span>
                </div>
                <div className="border-l border-rose-200 pl-3">
                  <span className="text-[10px] text-rose-700 block uppercase font-semibold">
                    {isHindi ? "तारीख़" : "Due Date"}
                  </span>
                  <span className="text-sm font-bold font-mono">
                    {isHindi ? `हर महीने की ${loanDueDay}` : `${loanDueDay} of month`}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs block">
                  {isHindi
                    ? "क़दम 1: सबसे पहले अपने बैंक खाते का बैलेंस चेक करें"
                    : "Step 1: First check if auto-debit was deducted"}
                </span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {isHindi
                    ? `हर महीने की ${loanDueDay} तारीख़ को अपने बैंक खाते में चेक करें कि क्या ${loanEmiFormatted} बैंक से कट गए हैं। अगर पैसे कट चुके हैं, तो आपको कुछ नहीं करना है।`
                    : `Check your bank account on the ${loanDueDay}. If ${loanEmiFormatted} was automatically deducted via NACH/auto-debit, no further action is needed.`}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <span className="font-bold text-amber-950 text-xs block">
                  {isHindi
                    ? "क़दम 2: अगर पैसे नहीं कटे, तो घबराएँ नहीं! इन 2 आसान तरीक़ों से भरें:"
                    : "Step 2: If auto-debit did not happen, don't worry! Use either method:"}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Way A */}
                  <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-1">
                    <span className="font-bold text-slate-900 text-xs block text-blue-700">
                      {isHindi ? "तरीक़ा 1: बैंक शाखा जाकर (सबसे आसान)" : "Option A: Visit Nearest Branch (Easiest)"}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isHindi ? (
                        <>
                          नज़दीकी <strong>{loanLender}</strong> शाखा में जाएँ। काउंटर पर कहें:{" "}
                          <em>“मुझे इस कार लोन की {loanEmiFormatted} की क़िस्त भरनी है।”</em>
                        </>
                      ) : (
                        <>
                          Walk into any <strong>{loanLender}</strong> branch. Ask the teller to deposit{" "}
                          <strong>{loanEmiFormatted}</strong> toward your loan account.
                        </>
                      )}
                    </p>
                    <div className="pt-1 text-[11px] font-mono bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-800">
                      <span className="font-sans font-semibold text-slate-500 text-[10px] block">
                        {isHindi ? "लोन खाता नंबर (Loan A/C):" : "Loan Account Number:"}
                      </span>
                      <strong>{loanAccount}</strong>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold block pt-1">
                      {isHindi ? "✓ जमा करने के बाद रसीद (Receipt) ज़रूर लें।" : "✓ Always collect the printed payment receipt."}
                    </span>
                  </div>

                  {/* Way B */}
                  <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-1">
                    <span className="font-bold text-slate-900 text-xs block text-blue-700">
                      {isHindi ? "तरीक़ा 2: मोबाइल UPI से (घर बैठे)" : "Option B: Online / Mobile UPI Payment"}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isHindi
                        ? "अपने किसी रिश्तेदार या खुद के Google Pay, PhonePe, या Paytm से इस UPI ID पर पेमेंट करें:"
                        : "Use any UPI app (GPay, PhonePe, Paytm, BHIM) to transfer directly:"}
                    </p>
                    <div className="pt-1 text-[11px] font-mono bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-800">
                      <span className="font-sans font-semibold text-slate-500 text-[10px] block">
                        UPI ID:
                      </span>
                      <strong>{loanUpi}</strong>
                    </div>
                    <span className="text-[10px] text-slate-500 block pt-1">
                      {isHindi ? "रिमार्क में लोन अकाउंट नंबर लिख दें।" : "Add loan account number in payment note."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Bank Accounts Guidance */}
        {tab === "bank" && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 text-xs text-slate-700">
            <div className="border-b border-slate-100 pb-3 space-y-0.5">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-indigo-600" />
                {isHindi
                  ? "बचत बैंक खातों से रक़म प्राप्त करने की प्रक्रिया"
                  : "How to Claim Savings Bank Account Balances"}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {isHindi
                  ? "बैंक शाखा में नॉमिनी के तौर पर बचत खाते की रक़म पाना बहुत सीधा है:"
                  : "Settling savings accounts as a registered nominee is straightforward:"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {isHindi ? "शाखा जाएँ" : "Step 1: Visit Branch"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                  {isHindi
                    ? "जिस बैंक में खाता है, उसकी नज़दीकी शाखा में जाएँ और बैंक प्रबंधक (Branch Manager) से मिलें।"
                    : "Visit the branch where the savings account is maintained and meet the manager."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {isHindi ? "नॉमिनी क्लेम फ़ॉर्म लें" : "Step 2: Fill Claim Form"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                  {isHindi
                    ? "बैंक से 'Deceased Claim / Nominee Settlement Form' मांगें। अपना आधार, पैन और मृत्यु प्रमाण पत्र संलग्न करें।"
                    : "Request the official Deceased Claim Form. Attach nominee's KYC (Aadhaar/PAN) and death certificate."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="font-bold text-emerald-950 text-xs">
                    {isHindi ? "खाते में ट्रांसफ़र" : "Step 3: Transfer to Nominee"}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 pl-7 leading-relaxed">
                  {isHindi
                    ? "बैंक 7 से 10 दिनों में सत्यापन पूरा करके बची हुई पूरी रक़म सीधे नॉमिनी के खाते में भेज देता है।"
                    : "The bank completes verification and directly transfers the remaining balance to the nominee."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Golden Safety Rules */}
        {tab === "rules" && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 text-xs text-slate-700">
            <div className="border-b border-slate-100 pb-3 space-y-0.5">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                {isHindi
                  ? "4 ज़रूरी सावधानियाँ — धोखाधड़ी से बचने के लिए क्या कभी न करें"
                  : "4 Golden Safety Rules — Never Fall for Frauds"}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {isHindi
                  ? "आपके परिवार की सुरक्षा के लिए ये 4 नियम हमेशा याद रखें:"
                  : "Always keep these strict security guidelines in mind:"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 space-y-1">
                <span className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                  {isHindi ? "1. फ़ोन पर कभी OTP या PIN न बताएं" : "1. Never Share OTP or ATM PIN"}
                </span>
                <p className="text-[11px] text-red-800 leading-relaxed pl-5">
                  {isHindi
                    ? "कोई भी व्यक्ति फ़ोन करके कहे कि वह बैंक, Groww या पुलिस से बोल रहा है, तो कभी भी फ़ोन पर OTP न दें। बैंक कभी फ़ोन पर OTP नहीं मांगता।"
                    : "No bank or investment official will ever ask for an OTP or PIN over phone calls or WhatsApp. Never share OTP with anyone."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 space-y-1">
                <span className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                  {isHindi ? "2. किसी दलाल या एजेंट को पैसे न दें" : "2. Never Pay Any Commission to Agents"}
                </span>
                <p className="text-[11px] text-red-800 leading-relaxed pl-5">
                  {isHindi
                    ? "नॉमिनी को पैसा दिलाने के नाम पर किसी को कोई फ़ीस या कमीशन न दें। बैंक और म्यूचुअल फंड का यह काम पूरी तरह मुफ़्त होता है।"
                    : "Nominee claims are 100% free by government regulations. Never pay commissions or fees to unauthorized agents."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                <span className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  {isHindi ? "3. सीधे बैंक शाखा जाकर बात करें" : "3. Always Visit Official Branches"}
                </span>
                <p className="text-[11px] text-blue-800 leading-relaxed pl-5">
                  {isHindi
                    ? "किसी भी बात में शंका होने पर किसी अनजान की बातों में न आएँ। सीधे अपने नज़दीकी बैंक की शाखा में जाएँ और बैंक मैनेजर से मिलें।"
                    : "In case of any doubt, visit the official branch in person or speak directly with the branch manager."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                <span className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  {isHindi ? "4. भुगतान की रसीद हमेशा संभालकर रखें" : "4. Always Keep Stamped Receipts"}
                </span>
                <p className="text-[11px] text-blue-800 leading-relaxed pl-5">
                  {isHindi
                    ? "जब भी आप कार लोन की EMI बैंक में जमा करें या कोई फ़ॉर्म दें, काउंटर से मोहर लगी रसीद (Acknowledged Receipt) ज़रूर लें और सुरक्षित रखें।"
                    : "Whenever paying an EMI or submitting claim paperwork, always retain the stamped bank receipt for your records."}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
