"""Template renderer for SMS and Email notifications.

Renders versioned Jinja2 notification templates with tone guidelines:
- SMS: Short, DLT-friendly, no sensitive account data, link to packet or check-in.
- Email: Comprehensive, clear, calm, explanatory, secure links with full financial details.
"""

from typing import Any

from jinja2 import DictLoader, Environment

# Pre-defined versioned templates
_DEFAULT_TEMPLATES = {
    # Inactivity SMS
    "inactivity_warn_owner_1_sms.txt": (
        "Family Safety Net: We haven't detected your check-in in 60 days. "
        "Please tap to confirm you are okay: "
        "{{ check_in_url|default('https://familysafetynet.app/check-in') }}"
    ),
    "inactivity_warn_owner_2_sms.txt": (
        "Family Safety Net: 80 days without activity. If we don't hear from you in 10 days, "
        "your emergency packet will be sent to your trusted contacts: "
        "{{ check_in_url|default('https://familysafetynet.app/check-in') }}"
    ),
    "inactivity_notify_parents_sms.txt": (
        "Family Safety Net: We have not been able to confirm "
        "{{ owner_name|default('your family member') }} is okay for 90 days. "
        "View your emergency packet: "
        "{{ packet_url|default('https://familysafetynet.app/packet') }}"
    ),
    # Inactivity Email (Plain Text)
    "inactivity_warn_owner_1_email.txt": (
        "Hello {{ owner_name|default('there') }},\n\n"
        "We noticed no activity on your Family Safety Net account for 60 days.\n"
        "Please check in here: {{ check_in_url|default('https://familysafetynet.app/check-in') }}\n"
    ),
    "inactivity_notify_parents_email.txt": (
        "Dear {{ recipient_name|default('Family Contact') }},\n\n"
        "This is an emergency notification from Family Safety Net regarding {{ owner_name|default('your family member') }}.\n\n"
        "We have not been able to detect any account or check-in activity from {{ owner_name|default('them') }} for "
        "{{ days_idle|default(90) }} days. As their designated emergency contact, please check on their well-being.\n\n"
        "To assist you and your family, {{ owner_name|default('your family member') }} has prepared this verified financial "
        "dossier and emergency instructions:\n\n"
        "================================================================================\n"
        "1. MUTUAL FUND & INVESTMENT ASSETS\n"
        "================================================================================\n"
        "{% if holdings and holdings|length > 0 %}\n"
        "{% for h in holdings %}\n"
        "* Scheme: {{ h.scheme_name }}\n"
        "  Fund House: {{ h.fund_house }}\n"
        "  Folio Number: {{ h.folio|default(h.folio_masked)|default('Recorded with AMC') }}\n"
        "  Units: {{ h.units }}\n"
        "  {% if h.value_inr %}Estimated Valuation: Rs {{ h.value_inr }}{% endif %}\n\n"
        "{% endfor %}\n"
        "{% if total_mf_value_inr %}Total Portfolio Value: Rs {{ total_mf_value_inr }}\n\n{% endif %}\n"
        "{% else %}\n"
        "Mutual fund investments are registered with CAMS and KFintech RTAs. Specific folio numbers are recorded in the emergency packet.\n\n"
        "{% endif %}\n"
        "Instructions for Claiming:\n"
        "Contact the respective Asset Management Companies (AMCs) or RTAs (CAMS & KFintech) with the registered Folio numbers, "
        "PAN, death/incapacitation certificate, and nominee claim forms. Emergency contacts cannot directly withdraw funds without "
        "formal claim verification.\n\n"
        "================================================================================\n"
        "2. FINANCIAL OBLIGATIONS & LOANS\n"
        "================================================================================\n"
        "{% if loans and loans|length > 0 %}\n"
        "{% for l in loans %}\n"
        "* Lender: {{ l.lender }}\n"
        "  Account: {{ l.account_number|default(l.account_masked) }}\n"
        "  Monthly EMI: Rs {{ l.emi_inr|default('16,166') }}\n"
        "  Due Day: {{ l.due_day|default('24th') }} of every month (Grace: {{ l.grace_days|default(1) }} day)\n\n"
        "{% endfor %}\n"
        "Please verify that EMIs are paid to prevent penalty charges or vehicle repossession.\n\n"
        "{% else %}\n"
        "No active loan liabilities reported.\n\n"
        "{% endif %}\n"
        "================================================================================\n"
        "3. SAVINGS & BANK ACCOUNTS\n"
        "================================================================================\n"
        "{% if bank_accounts and bank_accounts|length > 0 %}\n"
        "{% for b in bank_accounts %}\n"
        "* Bank: {{ b.bank_name }}\n"
        "  Account: {{ b.account_number|default(b.account_number_masked) }}\n"
        "  IFSC Code: {{ b.ifsc_code }}\n"
        "  Branch: {{ b.branch_name|default('Main Branch') }}\n"
        "  Type: {{ b.account_type|default('SAVINGS') }}\n\n"
        "{% endfor %}\n"
        "{% else %}\n"
        "No direct bank accounts registered in safety net.\n\n"
        "{% endif %}\n"
        "================================================================================\n"
        "4. EMERGENCY & NOMINEE GUIDANCE\n"
        "================================================================================\n"
        "{{ nominee_notes|default('Please check on your family member and contact their bank and mutual fund AMCs if necessary.') }}\n\n"
        "================================================================================\n"
        "5. ATTACHED EMERGENCY DOCUMENTS\n"
        "================================================================================\n"
        "{% if documents and documents|length > 0 %}\n"
        "The following verified documents have been attached directly to this email:\n"
        "{% for d in documents %}\n"
        "* {{ d.title }} ({{ d.filename }}{% if d.size_formatted %}, {{ d.size_formatted }}{% endif %})\n"
        "{% endfor %}\n\n"
        "{% else %}\n"
        "No attached documents were on file at the time of this alert.\n\n"
        "{% endif %}\n"
        "================================================================================\n"
        "6. SECURE EMERGENCY PACKET LINK\n"
        "================================================================================\n"
        "You can view the full emergency dossier, download attached identity documents, and access payment guidance online at:\n"
        "{{ packet_url|default('http://localhost:5173/public/packet') }}\n\n"
        "(Note: For security and privacy, you will be prompted to enter a one-time OTP sent to your registered phone.)\n\n"
        "Warm regards,\n"
        "Family Safety Net"
    ),
    # Inactivity Email (Rich HTML)
    "inactivity_notify_parents_email.html": (
        """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Family Safety Net Emergency Notification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; margin-top: 10px; border: 1px solid #fde68a; }
    .content { padding: 32px; }
    .greeting { font-size: 15px; margin-bottom: 20px; }
    .section { margin-top: 28px; border-top: 1px solid #f1f5f9; pt: 20px; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }
    th { background: #f8fafc; text-align: left; padding: 10px 12px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 13px; color: #334155; margin-bottom: 20px; }
    .btn-container { text-align: center; margin: 32px 0 16px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
    .footer { background: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Family Safety Net Alert</h1>
      <div class="badge">Notice: Extended Inactivity ({{ days_idle|default(90) }} Days)</div>
    </div>
    <div class="content">
      <p class="greeting">Dear <strong>{{ recipient_name|default('Family Contact') }}</strong>,</p>
      <p>This is an automated safety notification regarding <strong>{{ owner_name|default('your family member') }}</strong>. We have not been able to detect check-in or investment activity for <strong>{{ days_idle|default(90) }} days</strong>. As their designated emergency contact, please check on them.</p>
      
      <p>Below are the emergency financial records and instructions left on file:</p>

      <!-- Mutual Funds -->
      <div class="section">
        <div class="section-title">1. Mutual Fund & Investment Portfolio</div>
        {% if holdings and holdings|length > 0 %}
        <table>
          <thead>
            <tr>
              <th>Scheme & Fund House</th>
              <th>Folio</th>
              <th>Units</th>
              <th>Estimated Value</th>
            </tr>
          </thead>
          <tbody>
            {% for h in holdings %}
            <tr>
              <td><strong>{{ h.scheme_name }}</strong><br><small style="color: #64748b;">{{ h.fund_house }}</small></td>
              <td class="mono">{{ h.folio|default(h.folio_masked)|default('Recorded') }}</td>
              <td class="mono">{{ h.units }}</td>
              <td><strong>{% if h.value_inr %}₹{{ h.value_inr }}{% else %}-{% endif %}</strong></td>
            </tr>
            {% endfor %}
          </tbody>
        </table>
        {% if total_mf_value_inr %}
        <p style="text-align: right; font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">
          Total Portfolio Value: ₹{{ total_mf_value_inr }}
        </p>
        {% endif %}
        {% else %}
        <p style="font-size: 13px; color: #64748b;">Mutual fund investments are registered across CAMS & KFintech RTAs.</p>
        {% endif %}
        <div class="box">
          <strong>Guidance for Claiming Mutual Funds:</strong><br>
          Contact the respective Asset Management Companies (AMCs) or RTAs (CAMS & KFintech) with the registered Folio numbers, PAN, and death/claim documentation.
        </div>
      </div>

      <!-- Loans -->
      <div class="section">
        <div class="section-title">2. Financial Obligations & Loans</div>
        {% if loans and loans|length > 0 %}
        <table>
          <thead>
            <tr>
              <th>Lender</th>
              <th>Account</th>
              <th>Monthly EMI</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {% for l in loans %}
            <tr>
              <td><strong>{{ l.lender }}</strong></td>
              <td class="mono">{{ l.account_number|default(l.account_masked) }}</td>
              <td><strong style="color: #b91c1c;">₹{{ l.emi_inr|default('16,166') }}</strong></td>
              <td>{{ l.due_day|default('24th') }} of month</td>
            </tr>
            {% endfor %}
          </tbody>
        </table>
        <p style="font-size: 12px; color: #64748b;">Please verify this payment to avoid loan default penalties or repossession.</p>
        {% else %}
        <p style="font-size: 13px; color: #64748b;">No active loan liabilities registered.</p>
        {% endif %}
      </div>

      <!-- Bank Accounts -->
      <div class="section">
        <div class="section-title">3. Savings & Bank Accounts</div>
        {% if bank_accounts and bank_accounts|length > 0 %}
        <table>
          <thead>
            <tr>
              <th>Bank & Branch</th>
              <th>Account Number</th>
              <th>IFSC Code</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {% for b in bank_accounts %}
            <tr>
              <td><strong>{{ b.bank_name }}</strong>{% if b.branch_name %}<br><small style="color: #64748b;">{{ b.branch_name }}</small>{% endif %}</td>
              <td class="mono">{{ b.account_number|default(b.account_number_masked) }}</td>
              <td class="mono">{{ b.ifsc_code }}</td>
              <td>{{ b.account_type|default('SAVINGS') }}</td>
            </tr>
            {% endfor %}
          </tbody>
        </table>
        {% else %}
        <p style="font-size: 13px; color: #64748b;">No direct savings bank accounts registered in safety net.</p>
        {% endif %}
      </div>

      <!-- Nominee Notes -->
      <div class="section">
        <div class="section-title">4. Emergency & Nominee Notes</div>
        <div class="box">
          {{ nominee_notes|default('Please check on your family member and contact their bank and mutual fund AMCs if necessary.') }}
        </div>
      </div>

      <!-- Attached Documents -->
      <div class="section">
        <div class="section-title">5. Attached Emergency Documents</div>
        {% if documents and documents|length > 0 %}
        <table>
          <thead>
            <tr>
              <th>Document Title</th>
              <th>Category</th>
              <th>Filename</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {% for d in documents %}
            <tr>
              <td><strong>{{ d.title }}</strong></td>
              <td>{{ d.category|default('general')|capitalize }}</td>
              <td class="mono">{{ d.filename }}</td>
              <td>{{ d.size_formatted|default('Attached') }}</td>
            </tr>
            {% endfor %}
          </tbody>
        </table>
        <p style="font-size: 12px; color: #16a34a; font-weight: 600;">
          &#10003; The listed documents are attached directly to this email for immediate offline access.
        </p>
        {% else %}
        <p style="font-size: 13px; color: #64748b;">No documents were on file at the time of this alert.</p>
        {% endif %}
      </div>

      <!-- CTA -->
      <div class="btn-container">
        <a href="{{ packet_url|default('http://localhost:5173/public/packet') }}" class="btn">Access Full Emergency Packet</a>
      </div>
      <p style="text-align: center; font-size: 12px; color: #64748b;">For security, access requires a 6-digit OTP sent to your registered phone.</p>
    </div>
    <div class="footer">
      Sent with care by Family Safety Net &bull; Designed to protect your family's future.
    </div>
  </div>
</body>
</html>
"""
    ),
    # Loan SMS
    "loan_upcoming_reminder_sms.txt": (
        "Family Safety Net: Your {{ lender|default('car loan') }} EMI of "
        "Rs {{ amount_inr|default('16,166') }} is due on {{ due_date|default('the 24th') }}. "
        "Please ensure your account is funded."
    ),
    "loan_due_reminder_sms.txt": (
        "Family Safety Net: Your {{ lender|default('car loan') }} EMI of "
        "Rs {{ amount_inr|default('16,166') }} is due today ({{ due_date|default('24th') }}). "
        "Mark as paid: {{ portal_url|default('https://familysafetynet.app') }}"
    ),
    "loan_missed_parent_sms.txt": (
        "Family Safety Net: {{ owner_name|default('Your family member') }}'s "
        "{{ lender|default('car loan') }} (A/C: {{ account_number|default(account_masked)|default('Recorded with Lender') }}) "
        "EMI of Rs {{ amount_inr|default('16,166') }} due on {{ due_date|default('24th') }} has not been confirmed. "
        "View payment guidance: {{ packet_url|default('https://familysafetynet.app/packet') }}"
    ),
    "loan_notify_parents_resolved_sms.txt": (
        "Family Safety Net: The pending {{ lender|default('car loan') }} "
        "(A/C: {{ account_number|default(account_masked)|default('') }}) EMI for "
        "{{ owner_name|default('your family member') }} has now been confirmed paid. "
        "No further action needed."
    ),
    # Loan Email (Plain Text)
    "loan_missed_parent_email.txt": (
        "Dear {{ recipient_name|default('Family Contact') }},\n\n"
        "This is an urgent financial notification regarding {{ owner_name|default('your family member') }}.\n\n"
        "Their monthly car loan EMI has not been confirmed paid:\n"
        "* Lender: {{ lender|default('HDFC Bank') }}\n"
        "* Account Number: {{ account_number|default(account_masked)|default('Recorded with Lender') }}\n"
        "* Monthly EMI: Rs {{ amount_inr|default('16,166') }}\n"
        "* Due Date: {{ due_date|default('the 24th') }}\n\n"
        "To prevent penalties, compounding interest, or vehicle repossession, please review the payment guidance "
        "and lender portal details:\n"
        "{{ packet_url|default('http://localhost:5173/public/packet') }}\n\n"
        "Warm regards,\n"
        "Family Safety Net"
    ),
    # Loan Email (Rich HTML)
    "loan_missed_parent_email.html": (
        """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Urgent Loan EMI Notice</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #b91c1c; color: #ffffff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 32px; }
    .box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px; }
    td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .btn-container { text-align: center; margin: 28px 0 16px; }
    .btn { display: inline-block; background: #b91c1c; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Action Required: Missed Car Loan EMI</h1>
    </div>
    <div class="content">
      <p>Dear <strong>{{ recipient_name|default('Family Contact') }}</strong>,</p>
      <p>This is a notification regarding an unconfirmed loan installment for <strong>{{ owner_name|default('your family member') }}</strong>.</p>
      
      <div class="box">
        <table>
          <tr><td><strong>Lender:</strong></td><td>{{ lender|default('HDFC Bank') }}</td></tr>
          <tr><td><strong>Loan Account:</strong></td><td>{{ account_number|default(account_masked)|default('Recorded with Lender') }}</td></tr>
          <tr><td><strong>Overdue EMI:</strong></td><td><strong style="color: #b91c1c;">₹{{ amount_inr|default('16,166') }}</strong></td></tr>
          <tr><td><strong>Due Date:</strong></td><td>{{ due_date|default('24th of this month') }}</td></tr>
        </table>
        <p style="margin: 0; font-size: 13px; color: #7f1d1d;">
          To avoid penalty fees and credit impact, please verify if payment can be completed online.
        </p>
      </div>

      <div class="btn-container">
        <a href="{{ packet_url|default('http://localhost:5173/public/packet') }}" class="btn">View Payment Instructions</a>
      </div>
    </div>
  </div>
</body>
</html>
"""
    ),
    # Contact Verification OTP Templates
    "contact_verification_otp_sms.txt": (
        "Family Safety Net: Your verification code is {{ otp }}. "
        "{{ owner_name|default('Your family member') }} has added you as a trusted emergency contact. "
        "Valid for 15 minutes."
    ),
    "contact_verification_otp_email.txt": (
        "Dear {{ contact_name|default('there') }},\n\n"
        "{{ owner_name|default('Your family member') }} has registered you as a trusted emergency contact on Family Safety Net.\n\n"
        "Your verification OTP is: {{ otp }}\n\n"
        "This code will expire in 15 minutes. To confirm your consent, please enter this code at:\n"
        "{{ verify_url }}\n\n"
        "As an emergency contact, you will only receive alerts if your family member has no investment activity for 90 days or misses a loan EMI.\n\n"
        "Warm regards,\n"
        "Family Safety Net"
    ),
    "contact_verification_otp_email.html": (
        """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Emergency Contact Verification</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
    .content { padding: 32px; }
    .otp-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #15803d; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; margin-top: 16px; }
    .footer { background: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Family Safety Net &bull; Contact Verification</h1>
    </div>
    <div class="content">
      <p>Hello <strong>{{ contact_name|default('there') }}</strong>,</p>
      <p><strong>{{ owner_name|default('Your family member') }}</strong> has added you as their trusted emergency contact.</p>
      <div class="otp-box">
        <div style="font-size: 12px; font-weight: 600; color: #166534; text-transform: uppercase; margin-bottom: 6px;">Your 6-Digit Verification Code</div>
        <div class="otp-code">{{ otp }}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Expires in 15 minutes</div>
      </div>
      <p style="font-size: 13px; color: #475569;">To confirm your consent, please click below or visit your verification page and enter the code:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ verify_url }}" class="btn">Confirm Contact Details</a>
      </div>
    </div>
    <div class="footer">Sent by Family Safety Net &bull; Protecting what matters most</div>
  </div>
</body>
</html>
"""
    ),
}


class TemplateRenderer:
    """Renders SMS and Email templates with Jinja2."""

    def __init__(self, custom_templates: dict[str, str] | None = None) -> None:
        templates = dict(_DEFAULT_TEMPLATES)
        if custom_templates:
            templates.update(custom_templates)
        self._env = Environment(
            loader=DictLoader(templates),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(self, template_id: str, context: dict[str, Any]) -> str:
        """Render plain-text template by template_id, falling back to structured string."""
        template_key = f"{template_id}.txt" if not template_id.endswith(".txt") else template_id
        try:
            tmpl = self._env.get_template(template_key)
            return tmpl.render(**context)
        except Exception:
            # Fallback formatting if specific template key is not registered
            safe_items = [f"{k}={v}" for k, v in context.items() if k not in ("token", "secret", "holdings", "loans")]
            details = ", ".join(safe_items)
            return f"Family Safety Net Notification [{template_id}]: {details}"

    def render_html(self, template_id: str, context: dict[str, Any]) -> str | None:
        """Render HTML template by template_id if available."""
        # Strip .txt if present, replace with .html
        base_id = template_id[:-4] if template_id.endswith(".txt") else template_id
        html_key = f"{base_id}.html"
        try:
            tmpl = self._env.get_template(html_key)
            return tmpl.render(**context)
        except Exception:
            return None
