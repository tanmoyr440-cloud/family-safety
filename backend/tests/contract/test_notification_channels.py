"""Contract tests for NotificationChannel adapters using respx.

Tests contract invariants for:
- ConsoleChannel
- TwilioSmsChannel
- ResendEmailChannel

Invariants tested:
1. Success returns DeliveryResult with provider message ID.
2. 5xx and 429 server/rate-limit errors map to TransientDeliveryError.
3. Network timeouts map to TransientDeliveryError.
4. 4xx invalid recipient/auth errors map to PermanentDeliveryError.
5. NOTIFICATIONS_ALLOWLIST prevents outbound HTTP calls to non-allowlisted recipients.
6. Dry-run mode bypasses outbound HTTP calls.
"""

import httpx
import pytest
import respx

from app.application.ports.notification_channel import (
    OutboundMessage,
    PermanentDeliveryError,
    TransientDeliveryError,
)
from app.domain.policies.escalation_policy import ChannelKind
from app.infrastructure.notifications.console_channel import ConsoleChannel
from app.infrastructure.notifications.resend_email_channel import ResendEmailChannel
from app.infrastructure.notifications.twilio_sms_channel import TwilioSmsChannel


@pytest.mark.asyncio
async def test_console_channel_delivery() -> None:
    """Verifies ConsoleChannel records delivery and respects allowlist and dry-run."""
    channel = ConsoleChannel(kind=ChannelKind.SMS, allowlist=["+919876543210"], dry_run=False)

    # 1. Allowlisted recipient
    msg = OutboundMessage(
        id="msg-1",
        channel=ChannelKind.SMS,
        recipient="+919876543210",
        template_id="inactivity_warn_owner_1_sms",
        payload={"owner_name": "Test User"},
    )
    result = await channel.send(msg)
    assert result.provider_message_id.startswith("console-")
    assert len(channel.sent_messages) == 1

    # 2. Non-allowlisted recipient
    blocked_msg = OutboundMessage(
        id="msg-2",
        channel=ChannelKind.SMS,
        recipient="+919999999999",
        template_id="inactivity_warn_owner_1_sms",
        payload={},
    )
    b_result = await channel.send(blocked_msg)
    assert "allowlist-bypassed" in b_result.provider_message_id
    assert len(channel.sent_messages) == 1  # not appended


@pytest.mark.asyncio
@respx.mock
async def test_twilio_sms_channel_success() -> None:
    """Verifies successful Twilio SMS dispatch returns provider SID."""
    account_sid = "AC_test_account"
    auth_token = "test_auth_token"
    from_num = "+15005550006"
    to_num = "+919876543210"

    mock_route = respx.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    ).respond(
        status_code=201,
        json={"sid": "SM_mock_sid_12345", "status": "queued"},
    )

    async with httpx.AsyncClient() as client:
        channel = TwilioSmsChannel(
            account_sid=account_sid,
            auth_token=auth_token,
            from_number=from_num,
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-twilio-1",
            channel=ChannelKind.SMS,
            recipient=to_num,
            template_id="inactivity_warn_owner_1_sms",
            payload={"owner_name": "Tanmoy"},
        )

        result = await channel.send(msg)
        assert result.provider_message_id == "SM_mock_sid_12345"
        assert mock_route.called


@pytest.mark.asyncio
@respx.mock
async def test_twilio_sms_channel_permanent_error() -> None:
    """Verifies Twilio 400 invalid recipient error maps to PermanentDeliveryError."""
    account_sid = "AC_test_account"
    respx.post(f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json").respond(
        status_code=400,
        json={"code": 21211, "message": "The 'To' number is not a valid phone number."},
    )

    async with httpx.AsyncClient() as client:
        channel = TwilioSmsChannel(
            account_sid=account_sid,
            auth_token="token",
            from_number="+15005550006",
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-err-1",
            channel=ChannelKind.SMS,
            recipient="+910000000000",
            template_id="inactivity_warn_owner_1_sms",
            payload={},
        )

        with pytest.raises(PermanentDeliveryError) as exc_info:
            await channel.send(msg)
        assert "permanent" in str(exc_info.value).lower()


@pytest.mark.asyncio
@respx.mock
async def test_twilio_sms_channel_transient_error() -> None:
    """Verifies Twilio 500 error maps to TransientDeliveryError."""
    account_sid = "AC_test_account"
    respx.post(f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json").respond(
        status_code=500,
        text="Internal Server Error",
    )

    async with httpx.AsyncClient() as client:
        channel = TwilioSmsChannel(
            account_sid=account_sid,
            auth_token="token",
            from_number="+15005550006",
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-err-2",
            channel=ChannelKind.SMS,
            recipient="+919876543210",
            template_id="inactivity_warn_owner_1_sms",
            payload={},
        )

        with pytest.raises(TransientDeliveryError) as exc_info:
            await channel.send(msg)
        assert "transient" in str(exc_info.value).lower()


@pytest.mark.asyncio
@respx.mock
async def test_twilio_sms_channel_timeout() -> None:
    """Verifies network timeout maps to TransientDeliveryError."""
    account_sid = "AC_test_account"
    respx.post(f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json").mock(
        side_effect=httpx.ConnectTimeout("Connection timed out"),
    )

    async with httpx.AsyncClient() as client:
        channel = TwilioSmsChannel(
            account_sid=account_sid,
            auth_token="token",
            from_number="+15005550006",
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-err-3",
            channel=ChannelKind.SMS,
            recipient="+919876543210",
            template_id="inactivity_warn_owner_1_sms",
            payload={},
        )

        with pytest.raises(TransientDeliveryError):
            await channel.send(msg)


@pytest.mark.asyncio
@respx.mock
async def test_twilio_sms_allowlist_and_dry_run() -> None:
    """Verifies Twilio does not invoke HTTP API when blocked by allowlist or dry_run."""
    account_sid = "AC_test_account"
    mock_route = respx.post(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    ).respond(status_code=201, json={"sid": "SM_fake"})

    async with httpx.AsyncClient() as client:
        # Allowlist blocked
        channel = TwilioSmsChannel(
            account_sid=account_sid,
            auth_token="token",
            from_number="+15005550006",
            allowlist=["+919876543210"],
            dry_run=False,
            http_client=client,
        )
        msg1 = OutboundMessage(
            id="m1",
            channel=ChannelKind.SMS,
            recipient="+919999999999",
            template_id="inactivity_warn_owner_1_sms",
            payload={},
        )
        res1 = await channel.send(msg1)
        assert "allowlist-bypassed" in res1.provider_message_id
        assert not mock_route.called

        # Dry run active
        dry_channel = TwilioSmsChannel(
            account_sid=account_sid,
            auth_token="token",
            from_number="+15005550006",
            dry_run=True,
            http_client=client,
        )
        msg2 = OutboundMessage(
            id="m2",
            channel=ChannelKind.SMS,
            recipient="+919876543210",
            template_id="inactivity_warn_owner_1_sms",
            payload={},
        )
        res2 = await dry_channel.send(msg2)
        assert "dry-run" in res2.provider_message_id
        assert not mock_route.called


@pytest.mark.asyncio
@respx.mock
async def test_resend_email_channel_success() -> None:
    """Verifies successful Resend email dispatch returns provider ID."""
    mock_route = respx.post("https://api.resend.com/emails").respond(
        status_code=200,
        json={"id": "resend_email_id_999"},
    )

    async with httpx.AsyncClient() as client:
        channel = ResendEmailChannel(
            api_key="re_12345678",
            from_email="alerts@familysafetynet.app",
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-email-1",
            channel=ChannelKind.EMAIL,
            recipient="parent@example.com",
            template_id="inactivity_notify_parents_email",
            payload={"owner_name": "Tanmoy", "recipient_name": "Mom"},
        )

        result = await channel.send(msg)
        assert result.provider_message_id == "resend_email_id_999"
        assert mock_route.called


@pytest.mark.asyncio
@respx.mock
async def test_resend_email_channel_permanent_error() -> None:
    """Verifies Resend 422 validation failure maps to PermanentDeliveryError."""
    respx.post("https://api.resend.com/emails").respond(
        status_code=422,
        json={
            "statusCode": 422,
            "name": "validation_error",
            "message": "The to field must be a valid email.",
        },
    )

    async with httpx.AsyncClient() as client:
        channel = ResendEmailChannel(
            api_key="re_12345678",
            from_email="alerts@familysafetynet.app",
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-email-err",
            channel=ChannelKind.EMAIL,
            recipient="not-an-email",
            template_id="inactivity_notify_parents_email",
            payload={},
        )

        with pytest.raises(PermanentDeliveryError) as exc_info:
            await channel.send(msg)
        assert "permanent" in str(exc_info.value).lower()


@pytest.mark.asyncio
@respx.mock
async def test_resend_email_channel_transient_error() -> None:
    """Verifies Resend 429 rate limit maps to TransientDeliveryError."""
    respx.post("https://api.resend.com/emails").respond(
        status_code=429,
        json={"statusCode": 429, "name": "rate_limit_exceeded", "message": "Rate limit exceeded"},
    )

    async with httpx.AsyncClient() as client:
        channel = ResendEmailChannel(
            api_key="re_12345678",
            from_email="alerts@familysafetynet.app",
            http_client=client,
        )

        msg = OutboundMessage(
            id="msg-email-err-429",
            channel=ChannelKind.EMAIL,
            recipient="parent@example.com",
            template_id="inactivity_notify_parents_email",
            payload={},
        )

        with pytest.raises(TransientDeliveryError) as exc_info:
            await channel.send(msg)
        assert "transient" in str(exc_info.value).lower()


@pytest.mark.asyncio
@respx.mock
async def test_resend_email_allowlist_and_dry_run() -> None:
    """Verifies Resend does not invoke HTTP API when blocked by allowlist or dry_run."""
    mock_route = respx.post("https://api.resend.com/emails").respond(
        status_code=200, json={"id": "resend_fake"}
    )

    async with httpx.AsyncClient() as client:
        # Allowlist blocked
        channel = ResendEmailChannel(
            api_key="re_test",
            from_email="alerts@familysafetynet.app",
            allowlist=["allowed@example.com"],
            dry_run=False,
            http_client=client,
        )
        msg1 = OutboundMessage(
            id="m1",
            channel=ChannelKind.EMAIL,
            recipient="blocked@example.com",
            template_id="inactivity_notify_parents_email",
            payload={},
        )
        res1 = await channel.send(msg1)
        assert "allowlist-bypassed" in res1.provider_message_id
        assert not mock_route.called

        # Dry-run active
        dry_channel = ResendEmailChannel(
            api_key="re_test",
            from_email="alerts@familysafetynet.app",
            dry_run=True,
            http_client=client,
        )
        msg2 = OutboundMessage(
            id="m2",
            channel=ChannelKind.EMAIL,
            recipient="allowed@example.com",
            template_id="inactivity_notify_parents_email",
            payload={},
        )
        res2 = await dry_channel.send(msg2)
        assert "dry-run" in res2.provider_message_id
        assert not mock_route.called


@pytest.mark.asyncio
async def test_smtp_email_channel_dry_run_and_allowlist() -> None:
    """Verifies SmtpEmailChannel respects allowlist and dry-run modes."""
    from app.infrastructure.notifications.smtp_email_channel import SmtpEmailChannel

    # 1. Allowlist bypassed
    channel = SmtpEmailChannel(
        username="user@gmail.com",
        password="app_password",
        allowlist=["allowed@example.com"],
        dry_run=False,
    )
    blocked_msg = OutboundMessage(
        id="m1",
        channel=ChannelKind.EMAIL,
        recipient="blocked@example.com",
        template_id="inactivity_notify_parents_email",
        payload={"owner_name": "Tanmoy"},
    )
    res1 = await channel.send(blocked_msg)
    assert "allowlist-bypassed" in res1.provider_message_id

    # 2. Dry-run bypass
    dry_channel = SmtpEmailChannel(
        username="user@gmail.com",
        password="app_password",
        allowlist=["allowed@example.com"],
        dry_run=True,
    )
    allowed_msg = OutboundMessage(
        id="m2",
        channel=ChannelKind.EMAIL,
        recipient="allowed@example.com",
        template_id="inactivity_notify_parents_email",
        payload={
            "owner_name": "Tanmoy",
            "holdings": [
                {
                    "scheme_name": "Parag Parikh Flexi Cap",
                    "fund_house": "PPFAS",
                    "folio_masked": "XXXX1234",
                    "units": 100,
                }
            ],
            "loans": [
                {
                    "lender": "HDFC Bank",
                    "account_masked": "XXXX5678",
                    "emi_inr": "16,166",
                    "due_day": 24,
                }
            ],
        },
    )
    res2 = await dry_channel.send(allowed_msg)
    assert "dry-run" in res2.provider_message_id


@pytest.mark.asyncio
@respx.mock
async def test_resend_email_channel_with_attachments() -> None:
    """Verifies ResendEmailChannel correctly passes base64 attachments in API payload."""
    import base64

    from app.application.ports.notification_channel import EmailAttachment

    captured_payload: dict = {}

    def handle_request(request: httpx.Request) -> httpx.Response:
        import json
        nonlocal captured_payload
        captured_payload = json.loads(request.content)
        return httpx.Response(200, json={"id": "resend_with_att_123"})

    respx.post("https://api.resend.com/emails").mock(side_effect=handle_request)

    async with httpx.AsyncClient() as client:
        channel = ResendEmailChannel(
            api_key="re_12345678",
            from_email="alerts@familysafetynet.app",
            http_client=client,
        )

        sample_pdf_bytes = b"%PDF-1.4 Mock document bytes for test"
        msg = OutboundMessage(
            id="msg-att-1",
            channel=ChannelKind.EMAIL,
            recipient="parent@example.com",
            template_id="inactivity_notify_parents_email",
            payload={"owner_name": "Tanmoy"},
            attachments=[
                EmailAttachment(
                    filename="bank_passbook.pdf",
                    content=sample_pdf_bytes,
                    content_type="application/pdf",
                )
            ],
        )

        result = await channel.send(msg)
        assert result.provider_message_id == "resend_with_att_123"
        assert "attachments" in captured_payload
        assert len(captured_payload["attachments"]) == 1
        assert captured_payload["attachments"][0]["filename"] == "bank_passbook.pdf"
        assert (
            captured_payload["attachments"][0]["content"]
            == base64.b64encode(sample_pdf_bytes).decode("ascii")
        )
        assert "html" in captured_payload


@pytest.mark.asyncio
async def test_template_renderer_attached_documents_and_bank_accounts() -> None:
    """Verifies TemplateRenderer includes bank accounts and documents in text and HTML."""
    from app.infrastructure.notifications.template_renderer import TemplateRenderer

    renderer = TemplateRenderer()
    context = {
        "owner_name": "Tanmoy",
        "recipient_name": "Father",
        "bank_accounts": [
            {
                "bank_name": "SBI",
                "account_number_masked": "XXXX9876",
                "ifsc_code": "SBIN0001234",
                "branch_name": "Main",
                "account_type": "SAVINGS",
            }
        ],
        "documents": [
            {
                "title": "Will and Testament",
                "filename": "will.pdf",
                "category": "legal",
                "size_formatted": "2.5 MB",
            }
        ],
        "days_idle": 90,
    }

    text = renderer.render("inactivity_notify_parents_email", context)
    assert "SAVINGS & BANK ACCOUNTS" in text
    assert "SBI" in text
    assert "XXXX9876" in text
    assert "ATTACHED EMERGENCY DOCUMENTS" in text
    assert "Will and Testament" in text
    assert "will.pdf" in text

    html = renderer.render_html("inactivity_notify_parents_email", context)
    assert html is not None
    assert "Savings &amp; Bank Accounts" in html or "Savings & Bank Accounts" in html
    assert "SBI" in html
    assert "Attached Emergency Documents" in html
    assert "Will and Testament" in html
    assert "will.pdf" in html


@pytest.mark.asyncio
async def test_composite_fallback_email_channel() -> None:
    """Verifies CompositeFallbackEmailChannel tries primary and falls back on failure."""
    from datetime import datetime, UTC
    from app.application.ports.notification_channel import DeliveryResult
    from app.interfaces.worker.service import CompositeFallbackEmailChannel

    class MockFailingChannel(ConsoleChannel):
        async def send(self, message: OutboundMessage) -> DeliveryResult:
            raise TransientDeliveryError("SMTP timed out (blocked by firewall)")

    class MockWorkingChannel(ConsoleChannel):
        async def send(self, message: OutboundMessage) -> DeliveryResult:
            return DeliveryResult(
                provider_message_id="resend-success-123",
                delivered_at=datetime.now(UTC),
            )

    msg = OutboundMessage(
        id="msg-composite",
        channel=ChannelKind.EMAIL,
        recipient="parent@example.com",
        template_id="inactivity_notify_parents_email",
        payload={},
    )

    # 1. Fallback succeeds when primary fails
    composite = CompositeFallbackEmailChannel([MockFailingChannel(kind=ChannelKind.EMAIL), MockWorkingChannel(kind=ChannelKind.EMAIL)])
    result = await composite.send(msg)
    assert result.provider_message_id == "resend-success-123"

    # 2. Raises error if all fail
    failing_only = CompositeFallbackEmailChannel([MockFailingChannel(kind=ChannelKind.EMAIL)])
    with pytest.raises(TransientDeliveryError) as exc_info:
        await failing_only.send(msg)
    assert "timed out" in str(exc_info.value)

    # 3. Empty channels raise PermanentDeliveryError
    empty_composite = CompositeFallbackEmailChannel([])
    with pytest.raises(PermanentDeliveryError):
        await empty_composite.send(msg)

    # 4. Multiple failing channels report all errors
    class MockResendFailingChannel(ConsoleChannel):
        async def send(self, message: OutboundMessage) -> DeliveryResult:
            raise PermanentDeliveryError("Resend 403 Forbidden: domain not verified")

    multi_failing = CompositeFallbackEmailChannel([MockResendFailingChannel(kind=ChannelKind.EMAIL), MockFailingChannel(kind=ChannelKind.EMAIL)])
    with pytest.raises(TransientDeliveryError) as multi_exc_info:
        await multi_failing.send(msg)
    assert "MockResendFailingChannel" in str(multi_exc_info.value)
    assert "MockFailingChannel" in str(multi_exc_info.value)


@pytest.mark.asyncio
async def test_contact_notifications_unmasked_financial_details() -> None:
    """Verifies that notifications sent to emergency contacts include unmasked account numbers and folios."""
    from app.infrastructure.notifications.template_renderer import TemplateRenderer

    renderer = TemplateRenderer()

    # 1. Inactivity Alert Email to Contact
    email_context = {
        "owner_name": "Tanmoy",
        "recipient_name": "Father",
        "holdings": [
            {
                "scheme_name": "Parag Parikh Flexi Cap Fund",
                "fund_house": "PPFAS Mutual Fund",
                "units": 150.25,
                "folio": "1208160098765432",
                "folio_masked": "XXXX5432",
                "value_inr": "54,230.00",
            }
        ],
        "loans": [
            {
                "lender": "HDFC Bank Car Loan",
                "account_number": "50100456789123",
                "account_masked": "XXXX9123",
                "emi_inr": "16,166.00",
                "due_day": 24,
            }
        ],
        "bank_accounts": [
            {
                "bank_name": "State Bank of India",
                "account_number": "3045987123456",
                "account_number_masked": "XXXX3456",
                "ifsc_code": "SBIN0001234",
                "branch_name": "Salt Lake",
                "account_type": "SAVINGS",
            }
        ],
        "days_idle": 90,
    }

    text_email = renderer.render("inactivity_notify_parents_email", email_context)
    html_email = renderer.render_html("inactivity_notify_parents_email", email_context)

    # In both text and HTML, unmasked folio and account numbers must be present
    assert "1208160098765432" in text_email
    assert "50100456789123" in text_email
    assert "3045987123456" in text_email

    assert html_email is not None
    assert "1208160098765432" in html_email
    assert "50100456789123" in html_email
    assert "3045987123456" in html_email

    # 2. Missed Loan SMS to Contact
    loan_sms_context = {
        "owner_name": "Tanmoy",
        "lender": "HDFC Bank",
        "account_number": "50100456789123",
        "account_masked": "XXXX9123",
        "amount_inr": "16,166",
        "due_date": "24th",
        "packet_url": "https://familysafetynet.app/p/test-token",
    }
    sms_text = renderer.render("loan_missed_parent_sms", loan_sms_context)
    assert "50100456789123" in sms_text
    assert "HDFC Bank" in sms_text
    assert "16,166" in sms_text

    # 3. Missed Loan Email to Contact
    loan_email_text = renderer.render("loan_missed_parent_email", loan_sms_context)
    loan_email_html = renderer.render_html("loan_missed_parent_email", loan_sms_context)
    assert "50100456789123" in loan_email_text
    assert loan_email_html is not None
    assert "50100456789123" in loan_email_html



