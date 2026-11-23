/**
 * Spoken audio scripts for elderly parents and family members.
 * Composed in empathetic, warm, clear, conversational Bengali (and plain English),
 * designed to calm anxiety and provide step-by-step guidance when read aloud.
 */

export interface AudioGuidanceContext {
  ownerName: string;
  loanEmiFormatted: string;
  loanDueDay: string;
  loanUpi: string;
  loanLender: string;
  loanAccount: string;
}

export function getAudioScript(
  tab: "mf" | "insurance" | "loan" | "bank" | "rules",
  lang: "bn" | "en",
  ctx: AudioGuidanceContext,
): { title: string; text: string } {
  if (lang === "bn") {
    switch (tab) {
      case "mf":
        return {
          title: "মিউচুয়াল ফান্ড ও শেয়ারের টাকা তোলার নিয়ম",
          text: `নমস্কার। কোনো রকম উদ্বেগের কারণ নেই। আপনার সন্তানের সমস্ত মিউচুয়াল ফান্ড এবং শেয়ার সরকারি নিয়মে রেজিস্ট্রি ক্যাম্পস ও কে-ফিনটেকে সম্পূর্ণ সুরক্ষিত আছে। টাকা তোলার জন্য চারটি সহজ ধাপ রয়েছে। প্রথমত: আপনার আধার কার্ড, প্যান কার্ড এবং ব্যাংক পাসবুক সঙ্গে রাখুন। দ্বিতীয়ত: নিকটস্থ ক্যাম্পস বা কে-ফিনটেক অফিসে যান। সেখানে অফিসারকে বলুন আপনি নমিনী হিসেবে টাকা ক্লেইম করতে চান। তৃতীয়ত: ক্লেইম ফর্ম ও প্রয়োজনীয় নথিপত্র জমা দিন। চতুর্থত: যাচাই শেষ হলে সমস্ত টাকা সরাসরি আপনার ব্যাংক একাউন্টে জমা হয়ে যাবে। কোনো দালালের কথায় টাকা বা ওটিপি দেবেন না।`,
        };
      case "insurance":
        return {
          title: "স্বাস্থ্য ও জীবন বীমা ক্যাশলেস চিকিৎসার নিয়ম",
          text: `জরুরি স্বাস্থ্য বীমা ও চিকিৎসার নির্দেশিকা। যদি হাসপাতালে ভর্তির প্রয়োজন হয়, তবে সরাসরি হাসপাতালের ক্যাশলেস বা টি-পি-এ কাউন্টারে যান। আপনার সন্তানের হেলথ ইন্সুরেন্স পলিসি নম্বরটি দেখান। কোনো আগাম টাকা দিতে হবে না, ইন্সুরেন্স কোম্পানি সরাসরি হাসপাতালের বিল পরিশোধ করবে। কোনো সাহায্যের প্রয়োজন হলে জরুরি টোল-ফ্রি হেল্পলাইন নম্বরে অবিলম্বে ফোন করুন।`,
        };
      case "loan":
        return {
          title: "গাড়ির লোনের কিস্তি (EMI) পরিশোধের নিয়ম",
          text: `গাড়ির লোনের কিস্তি বা ই-এম-আই পরিশোধ করার নির্দেশিকা। প্রতি মাসের ${ctx.loanDueDay} তারিখে ${ctx.loanEmiFormatted} টাকা কিস্তি জমা দিতে হবে। সবথেকে সহজ ও দ্রুত উপায় হলো মোবাইল ইউপিআই। গুগল পে, ফোন পে বা পেটিএম অ্যাপ খুলে ${ctx.loanUpi} এই ইউপিআই আইডিতে সরাসরি কিস্তির টাকা পাঠিয়ে দিন। অথবা নিকটস্থ ${ctx.loanLender} ব্যাংকে গিয়ে লোন নম্বর ${ctx.loanAccount}-এ টাকা জমা দিয়ে অবশ্যই সিল মারা রসিদ নিজের কাছে রাখবেন।`,
        };
      case "bank":
        return {
          title: "ব্যাংক একাউন্ট থেকে টাকা তোলার নিয়ম",
          text: `ব্যাংক একাউন্ট থেকে টাকা তোলার নিয়ম। আপনার সন্তানের ব্যাংক শাখায় ম্যানেজারের সাথে দেখা করুন। বলুন আপনি একাউন্টের রেজিস্টার্ড নমিনী। সেখানে নমিনী ক্লেইম ফর্ম পূরণ করুন এবং আপনার নিজের একাউন্টের বাতিল চেক জমা দিন। কয়েক দিনের মধ্যেই টাকা আপনার একাউন্টে ট্রান্সফার হয়ে যাবে।`,
        };
      case "rules":
        return {
          title: "জরুরি নিরাপত্তা ও সতর্কবার্তা",
          text: `সবথেকে জরুরি সতর্কতা। ভুলেও কারো সাথে ফোনের ওটিপি বা এটিএম পিন শেয়ার করবেন না। টাকা পাইয়ে দেওয়ার নামে কোনো এজেন্ট বা দালালকে কমিশন দেবেন না। সমস্ত কাজ সরাসরি ব্যাংকের অফিসিয়াল শাখায় গিয়ে করবেন এবং সব সময় সিল মারা রসিদ নিজের কাছে রাখবেন।`,
        };
    }
  }

  // English fallback
  switch (tab) {
    case "mf":
      return {
        title: "How to Claim Mutual Funds and Stocks",
        text: `Hello. Please do not worry. All investments are safely recorded with regulated registries CAMS and KFintech. To claim the funds: First, keep your Aadhaar, PAN card, and bank passbook ready. Second, visit your nearest CAMS or KFintech branch. Tell the officer that you are the registered nominee. Third, fill out the transmission claim form. Once verified, the investment value will be transferred directly to your bank account. Never pay any fee or commission to unauthorized agents.`,
      };
    case "insurance":
      return {
        title: "Cashless Health Insurance and Claims Guidance",
        text: `In case of emergency hospitalization, proceed directly to the hospital's Insurance or TPA desk. Present ${ctx.ownerName}'s health insurance policy details. The insurance company pays approved hospital bills directly without requiring upfront cash. Contact the 24/7 emergency helpline number listed below if any assistance is needed.`,
      };
    case "loan":
      return {
        title: "Car Loan EMI Payment Instructions",
        text: `To prevent penalties, the monthly installment of ${ctx.loanEmiFormatted} is due on the ${ctx.loanDueDay} of each month. The easiest method is via Mobile UPI: send the payment to ${ctx.loanUpi} using Google Pay, PhonePe, or any UPI app. Alternatively, visit the nearest ${ctx.loanLender} branch and pay against loan account ${ctx.loanAccount}, and always collect the stamped payment receipt.`,
      };
    case "bank":
      return {
        title: "Bank Accounts and Nominee Claim Process",
        text: `To claim bank account balances, visit the home bank branch and meet with the branch manager. Request the deceased or nominee claim form, provide a cancelled cheque of your own savings bank account, and the funds will be credited to your account upon verification.`,
      };
    case "rules":
      return {
        title: "Important Safety and Fraud Protection Rules",
        text: `Important safety reminder: Never share OTPs or ATM PINs with anyone over the phone. Never pay commission to any agent. Always complete financial transactions directly at official bank branches and retain all stamped receipts.`,
      };
  }
}
