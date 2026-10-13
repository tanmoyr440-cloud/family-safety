"""Document store port protocol."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class DocumentMetadata:
    """Metadata for an encrypted document."""

    id: str
    owner_id: str
    title: str
    file_name: str
    file_size_bytes: int
    content_type: str
    sha256_hash: str
    uploaded_at: datetime


class DocumentStore(Protocol):
    """Protocol for encrypted document storage."""

    async def list_for_owner(self, owner_id: str) -> list[DocumentMetadata]:
        """List metadata of all stored documents for an owner."""
        ...

    async def get_metadata(self, document_id: str) -> DocumentMetadata | None:
        """Fetch metadata for a document by its identifier."""
        ...
