"""Exceptions for Groww integration adapter."""


class GrowwIntegrationError(Exception):
    """Base exception for Groww integration errors."""


class GrowwFeatureDisabledError(GrowwIntegrationError):
    """Raised when Groww adapter operation is requested while disabled."""


class GrowwAuthenticationExpiredError(GrowwIntegrationError):
    """Raised when Groww API authentication credentials or session have expired."""
