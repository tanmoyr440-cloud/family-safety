"""Test doubles package."""

from tests.fakes.fake_clock import FakeClock
from tests.fakes.fake_document_store import FakeDocumentStore
from tests.fakes.in_memory_uow import InMemoryUnitOfWork
from tests.fakes.recording_channel import RecordingChannel

__all__ = [
    "FakeClock",
    "FakeDocumentStore",
    "InMemoryUnitOfWork",
    "RecordingChannel",
]
