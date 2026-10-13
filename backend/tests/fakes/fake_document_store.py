"""Fake document store test double."""

from app.application.ports.document_store import DocumentMetadata, DocumentStore


class FakeDocumentStore(DocumentStore):
    """In-memory DocumentStore for testing."""

    def __init__(self) -> None:
        self.documents: dict[str, DocumentMetadata] = {}

    async def list_for_owner(self, owner_id: str) -> list[DocumentMetadata]:
        return [doc for doc in self.documents.values() if doc.owner_id == owner_id]

    async def get_metadata(self, document_id: str) -> DocumentMetadata | None:
        return self.documents.get(document_id)

    def add_document(self, metadata: DocumentMetadata) -> None:
        self.documents[metadata.id] = metadata
