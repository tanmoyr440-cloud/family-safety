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

type Language = "en" | "bn";
type ActiveTab = "mf" | "loan" | "bank" | "rules";

export const ParentSimpleGuideCard: React.FC<ParentSimpleGuideCardProps> = ({
  ownerName,
  loans = [],
}) => {
  const [lang, setLang] = React.useState<Language>("bn");
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

  const isBengali = lang === "bn";

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
                {isBengali ? "সহজ বাংলায় নির্দেশিকা" : "Simple Family Guide"}
              </span>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-0.5">
              {isBengali
                ? "বাবা-মা ও পরিবারের জন্য সহজ নির্দেশিকা"
                : `Step-by-Step Guidance for ${ownerName}'s Parents`}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isBengali
                ? "মিউচুয়াল ফান্ড/শেয়ারের টাকা তোলা ও লোনের কিস্তি (EMI) দেওয়ার সহজ নিয়ম"
                : "Simple, jargon-free instructions on how to handle investments, loans, and bank accounts"}
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
          <Languages className="h-3.5 w-3.5 text-slate-500 ml-1.5 mr-0.5" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setLang("bn")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all",
              isBengali
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900",
            )}
            aria-pressed={isBengali}
          >
            বাংলা (Bengali)
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={cn(
              "px-2.5 py-1 text-xs font-semibold rounded-lg transition-all",
              !isBengali
                ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900",
            )}
            aria-pressed={!isBengali}
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
              <span className="block">{isBengali ? "মিউচুয়াল ফান্ড / শেয়ার" : "Mutual Funds & Stocks"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isBengali ? "টাকা কীভাবে পাবেন" : "How to claim"}
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
              <span className="block">{isBengali ? "গাড়ির লোন EMI" : "Car Loan EMI"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isBengali ? "কিস্তি কীভাবে দেবেন" : "How to pay"}
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
              <span className="block">{isBengali ? "ব্যাংক অ্যাকাউন্ট" : "Bank Accounts"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isBengali ? "টাকা কীভাবে নেবেন" : "Nominee claim"}
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
              <span className="block">{isBengali ? "জরুরি সতর্কতা" : "Safety Rules"}</span>
              <span className="text-[10px] font-normal text-muted-foreground block">
                {isBengali ? "যা কখনো করবেন না" : "What to avoid"}
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
                  {isBengali
                    ? "মিউচুয়াল ফান্ড ও শেয়ারের টাকা তোলার সহজ ধাপ"
                    : "How to Claim & Redeem Mutual Funds & Stocks"}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {isBengali
                    ? "আপনার সন্তানের সমস্ত বিনিয়োগ সেবি (SEBI) ও রেজিস্ট্রি (CAMS / KFintech)-র কাছে সম্পূর্ণ নিরাপদ রয়েছে। টাকা পাওয়ার ৪টি সহজ ধাপ:"
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
                    {isBengali ? "কাগজপত্র গুছিয়ে নিন (Documents needed)" : "Step 1: Gather 4 simple documents"}
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-700 pl-7 list-disc">
                  <li>
                    {isBengali
                      ? "নমিনির (বাবা/মা) আধার কার্ড ও প্যান কার্ডের জেরক্স"
                      : "Nominee's Aadhaar Card & PAN Card"}
                  </li>
                  <li>
                    {isBengali
                      ? "নমিনির ব্যাংক পাসবইয়ের প্রথম পাতার জেরক্স অথবা ক্যান্সেলড চেক (যে অ্যাকাউন্টে টাকা আসবে)"
                      : "Nominee's bank passbook or cancelled cheque (for direct transfer)"}
                  </li>
                  <li>
                    {isBengali
                      ? "ফোলিও নম্বর (নিচের তালিকায় সব ফোলিও নম্বর দেওয়া আছে)"
                      : "Folio numbers listed in the table below"}
                  </li>
                  <li>
                    {isBengali
                      ? "অরিজিনাল ডেথ সার্টিফিকেট ও জেরক্স (যদি সন্তান দুর্ভাগ্যবশত প্রয়াত হয়ে থাকেন)"
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
                    {isBengali ? "কোথায় যোগাযোগ করবেন (Where to contact)" : "Step 2: Visit nearest registry or call"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 pl-7 space-y-1 leading-relaxed">
                  <p>
                    {isBengali
                      ? "আপনার জেলার নিকটবর্তী CAMS অথবা KFintech-এর অফিশিয়াল অফিসে যান (প্রতিটি শহরে অফিস রয়েছে) অথবা টোল-ফ্রি নম্বরে ফোন করুন:"
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
                    {isBengali ? "অফিসে গিয়ে কী বলবেন (What to say)" : "Step 3: What to ask the officer"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 pl-7 italic bg-white p-2 rounded-lg border border-slate-200">
                  {isBengali
                    ? `“আমার সন্তানের (${ownerName}) মিউচুয়াল ফান্ড এই ফোলিওতে রয়েছে। আমি নমিনি, আমাকে অনুগ্রহ করে 'নমিনি ট্রান্সমিশন ফর্ম' (Nominee Claim Form) দিন।”`
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
                    {isBengali ? "সরাসরি আপনার ব্যাংক অ্যাকাউন্টে টাকা আসবে" : "Step 4: Direct deposit to your account"}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-900 pl-7 space-y-1">
                  <p>
                    {isBengali
                      ? "ফর্ম জমা দেওয়ার ৭ থেকে ১৫ দিনের মধ্যে সমস্ত টাকা সরাসরি নমিনির ব্যাংক অ্যাকাউন্টে (NEFT/RTGS-এর মাধ্যমে) চলে আসে।"
                      : "Within 7 to 15 working days, AMCs transfer funds directly into the nominee's verified bank account."}
                  </p>
                  <p className="font-semibold text-[10px] text-emerald-800">
                    {isBengali
                      ? "✓ এটি সম্পূর্ণ সরকারি ও বিনামূল্যের পদ্ধতি। কোনো দালাল বা মধ্যস্থতাকারীকে কোনো টাকা বা কমিশন দেবেন না।"
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
                  {isBengali
                    ? "গাড়ির লোনের কিস্তি (EMI) কীভাবে ও কখন দেবেন"
                    : "How to Pay the Monthly Car Loan EMI"}
                </h3>
                <p className="text-muted-foreground text-[11px]">
                  {isBengali
                    ? "গাড়ির ওপর কোনো লেট ফি বা পেনাল্টি এড়াতে সময়মতো কিস্তি পরিশোধের উপায়:"
                    : "Prevent late payment penalties or repossession with these simple steps:"}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-center gap-3">
                <div>
                  <span className="text-[10px] text-rose-700 block uppercase font-semibold">
                    {isBengali ? "মাসিক কিস্তি" : "Monthly EMI"}
                  </span>
                  <span className="text-sm font-bold font-mono">{loanEmiFormatted}</span>
                </div>
                <div className="border-l border-rose-200 pl-3">
                  <span className="text-[10px] text-rose-700 block uppercase font-semibold">
                    {isBengali ? "তারিখ" : "Due Date"}
                  </span>
                  <span className="text-sm font-bold font-mono">
                    {isBengali ? `প্রতি মাসের ${loanDueDay} তারিখ` : `${loanDueDay} of month`}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs block">
                  {isBengali
                    ? "ধাপ ১: প্রথমে নিজের ব্যাংক ব্যালেন্স চেক করুন"
                    : "Step 1: First check if auto-debit was deducted"}
                </span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {isBengali
                    ? `প্রতি মাসের ${loanDueDay} তারিখে ব্যাংক অ্যাকাউন্ট বা মেসেজ চেক করুন যে ${loanEmiFormatted} ব্যাংক থেকে অটো-ডেবিট হয়েছে কি না। টাকা কেটে গেলে আপনার আর কিছু করার প্রয়োজন নেই।`
                    : `Check your bank account on the ${loanDueDay}. If ${loanEmiFormatted} was automatically deducted via NACH/auto-debit, no further action is needed.`}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <span className="font-bold text-amber-950 text-xs block">
                  {isBengali
                    ? "ধাপ ২: যদি টাকা না কেটে থাকে, তবে চিন্তা করবেন না! এই ২টি সহজ উপায়ে কিস্তি দিন:"
                    : "Step 2: If auto-debit did not happen, don't worry! Use either method:"}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Way A */}
                  <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-1">
                    <span className="font-bold text-slate-900 text-xs block text-blue-700">
                      {isBengali ? "উপায় ১: ব্যাংক শাখায় গিয়ে (সবচেয়ে সহজ ও নিরাপদ)" : "Option A: Visit Nearest Branch (Easiest)"}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isBengali ? (
                        <>
                          নিকটবর্তী <strong>{loanLender}</strong> শাখায় যান। কাউন্টারে গিয়ে বলুন:{" "}
                          <em>“আমি এই গাড়ির লোনের {loanEmiFormatted} টাকার কিস্তি জমা দিতে চাই।”</em>
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
                        {isBengali ? "লোন অ্যাকাউন্ট নম্বর (Loan A/C):" : "Loan Account Number:"}
                      </span>
                      <strong>{loanAccount}</strong>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold block pt-1">
                      {isBengali ? "✓ টাকা জমা দেওয়ার পর সিল দেওয়া রসিদ (Receipt) অবশ্যই সংগ্রহ করবেন।" : "✓ Always collect the printed payment receipt."}
                    </span>
                  </div>

                  {/* Way B */}
                  <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-1">
                    <span className="font-bold text-slate-900 text-xs block text-blue-700">
                      {isBengali ? "উপায় ২: মোবাইল UPI দিয়ে (ঘরে বসে)" : "Option B: Online / Mobile UPI Payment"}
                    </span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isBengali
                        ? "আত্মীয়ের বা নিজের Google Pay, PhonePe বা Paytm থেকে এই UPI ID-তে পেমেন্ট করুন:"
                        : "Use any UPI app (GPay, PhonePe, Paytm, BHIM) to transfer directly:"}
                    </p>
                    <div className="pt-1 text-[11px] font-mono bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-800">
                      <span className="font-sans font-semibold text-slate-500 text-[10px] block">
                        UPI ID:
                      </span>
                      <strong>{loanUpi}</strong>
                    </div>
                    <span className="text-[10px] text-slate-500 block pt-1">
                      {isBengali ? "পেমেন্টের নোটে লোন অ্যাকাউন্ট নম্বরটি লিখে দেবেন।" : "Add loan account number in payment note."}
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
                {isBengali
                  ? "সেভিংস ব্যাংক অ্যাকাউন্টের টাকা তোলার পদ্ধতি"
                  : "How to Claim Savings Bank Account Balances"}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {isBengali
                  ? "ব্যাংক অ্যাকাউন্ট থেকে নমিনি হিসেবে ব্যালেন্স তোলার নিয়ম অত্যন্ত সহজ:"
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
                    {isBengali ? "শাখা পরিদর্শন" : "Step 1: Visit Branch"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                  {isBengali
                    ? "যে ব্যাংকে সেভিংস অ্যাকাউন্ট রয়েছে, তার নিকটবর্তী শাখায় গিয়ে ব্রাঞ্চ ম্যানেজারের সাথে দেখা করুন।"
                    : "Visit the branch where the savings account is maintained and meet the manager."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {isBengali ? "নমিনি ফর্ম পূরণ" : "Step 2: Fill Claim Form"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 pl-7 leading-relaxed">
                  {isBengali
                    ? "ব্যাংক থেকে 'Deceased Claim / Nominee Settlement Kit' চেয়ে নিন। নমিনির আধার, প্যান ও প্রয়োজনীয় সার্টিফিকেট জমা দিন।"
                    : "Request the official Deceased Claim Form. Attach nominee's KYC (Aadhaar/PAN) and death certificate."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="font-bold text-emerald-950 text-xs">
                    {isBengali ? "অ্যাকাউন্টে ট্রান্সফার" : "Step 3: Transfer to Nominee"}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 pl-7 leading-relaxed">
                  {isBengali
                    ? "ব্যাংক ভেরিফিকেশন সম্পন্ন করে ৭ থেকে ১০ দিনের মধ্যে অ্যাকাউন্টের সমস্ত ব্যালেন্স সরাসরি নমিনির অ্যাকাউন্টে পাঠিয়ে দেবে।"
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
                {isBengali
                  ? "৪টি অতি জরুরি সতর্কতা — প্রতারণা থেকে বাঁচতে যা কখনোই করবেন না"
                  : "4 Golden Safety Rules — Never Fall for Frauds"}
              </h3>
              <p className="text-muted-foreground text-[11px]">
                {isBengali
                  ? "আপনার পরিবারের সুরক্ষার জন্য এই ৪টি নিয়ম সর্বদা মনে রাখবেন:"
                  : "Always keep these strict security guidelines in mind:"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 space-y-1">
                <span className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                  {isBengali ? "১. ফোনে কাউকে কখনোই OTP বা পিন বলবেন না" : "1. Never Share OTP or ATM PIN"}
                </span>
                <p className="text-[11px] text-red-800 leading-relaxed pl-5">
                  {isBengali
                    ? "ব্যাংক, Groww বা পুলিশ পরিচয় দিয়ে কেউ ফোন করে OTP চাইলে কখনোই বলবেন না। ব্যাংক বা অফিশিয়াল প্রতিষ্ঠান কখনো ফোনে OTP চায় না।"
                    : "No bank or investment official will ever ask for an OTP or PIN over phone calls or WhatsApp. Never share OTP with anyone."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 space-y-1">
                <span className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                  <AlertOctagon className="h-4 w-4 text-red-600 shrink-0" />
                  {isBengali ? "২. কোনো দালাল বা এজেন্টকে টাকা দেবেন না" : "2. Never Pay Any Commission to Agents"}
                </span>
                <p className="text-[11px] text-red-800 leading-relaxed pl-5">
                  {isBengali
                    ? "নমিনির টাকা তোলার জন্য কোনো এজেন্টের সাহায্য বা কমিশনের প্রয়োজন নেই। সরকারি নিয়মে এই কাজ সম্পূর্ণ বিনামূল্যে হয়।"
                    : "Nominee claims are 100% free by government regulations. Never pay commissions or fees to unauthorized agents."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                <span className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  {isBengali ? "৩. সরাসরি অফিশিয়াল ব্যাংক শাখায় যোগাযোগ করুন" : "3. Always Visit Official Branches"}
                </span>
                <p className="text-[11px] text-blue-800 leading-relaxed pl-5">
                  {isBengali
                    ? "কোনো ব্যাপারে সন্দেহ হলে কোনো অচেনা লোকের কথায় কান না দিয়ে সরাসরি ব্যাংক ম্যানেজারের কাছে যান অথবা পরিবারের কোনো বিশ্বস্ত সদস্যকে সাথে রাখুন।"
                    : "In case of any doubt, visit the official branch in person or speak directly with the branch manager."}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                <span className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  {isBengali ? "৪. পেমেন্টের রসিদ সবসময় যত্ন করে রাখুন" : "4. Always Keep Stamped Receipts"}
                </span>
                <p className="text-[11px] text-blue-800 leading-relaxed pl-5">
                  {isBengali
                    ? "লোনের কিস্তি ব্যাংকে জমা দিলে বা কোনো ফর্ম জমা দিলে কাউন্টার থেকে সিল দেওয়া রসিদ অবশ্যই চেয়ে নেবেন এবং নিরাপদে রাখবেন।"
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
