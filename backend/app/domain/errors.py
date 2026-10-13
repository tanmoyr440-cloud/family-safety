"""Domain error definitions.

All domain errors inherit from DomainError and carry a stable machine-readable error code.
Pure Python: no HTTP or framework dependencies.
"""


class DomainError(Exception):
    """Base exception for all domain errors."""

    def __init__(self, message: str, code: str = "DOMAIN_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class InvalidMoney(DomainError):
    """Raised when an invalid money amount is provided."""

    def __init__(self, message: str = "Invalid money amount") -> None:
        super().__init__(message, code="INVALID_MONEY")


class InvalidPhoneNumber(DomainError):
    """Raised when a phone number is not a valid E.164 string."""

    def __init__(self, message: str = "Invalid E.164 phone number") -> None:
        super().__init__(message, code="INVALID_PHONE_NUMBER")


class InvalidEmailAddress(DomainError):
    """Raised when an email address format is invalid."""

    def __init__(self, message: str = "Invalid email address format") -> None:
        super().__init__(message, code="INVALID_EMAIL_ADDRESS")


class InvalidDueDay(DomainError):
    """Raised when a due day is outside 1-31."""

    def __init__(self, message: str = "Due day must be between 1 and 31") -> None:
        super().__init__(message, code="INVALID_DUE_DAY")


class InvalidDays(DomainError):
    """Raised when a days duration is negative."""

    def __init__(self, message: str = "Days must be non-negative") -> None:
        super().__init__(message, code="INVALID_DAYS")


class InvalidThresholds(DomainError):
    """Raised when inactivity warning thresholds are invalid."""

    def __init__(self, message: str = "Invalid inactivity thresholds") -> None:
        super().__init__(message, code="INVALID_THRESHOLDS")


class PauseTooLong(DomainError):
    """Raised when a monitoring pause duration exceeds the allowed maximum."""

    def __init__(self, message: str = "Monitoring pause exceeds maximum allowed duration") -> None:
        super().__init__(message, code="PAUSE_TOO_LONG")


class ContactNotVerified(DomainError):
    """Raised when attempting an operation requiring a verified contact."""

    def __init__(self, message: str = "Contact consent is not verified") -> None:
        super().__init__(message, code="CONTACT_NOT_VERIFIED")


class NoVerifiedContactsError(DomainError):
    """Raised when an escalation requires verified contacts but none exist."""

    def __init__(self, message: str = "No verified contacts available for escalation") -> None:
        super().__init__(message, code="NO_VERIFIED_CONTACTS")


class InstallmentNotFound(DomainError):
    """Raised when an installment is not found."""

    def __init__(self, message: str = "Installment not found") -> None:
        super().__init__(message, code="INSTALLMENT_NOT_FOUND")


class LoanEnded(DomainError):
    """Raised when an operation is attempted on an ended loan."""

    def __init__(self, message: str = "Loan has already ended") -> None:
        super().__init__(message, code="LOAN_ENDED")
