"""Documents storage and management router conforming to api-contract.md."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Form, Header, UploadFile, status
from sqlalchemy import select

from app.domain.entities.owner import Owner
from app.infrastructure.persistence.models import DocumentModel
from app.infrastructure.security.audit_logger import record_audit_event
from app.infrastructure.storage.encrypted_document_store import EncryptedDocumentStore
from app.interfaces.api.dependencies import get_current_owner, get_session_factory
from app.interfaces.api.errors import (
    NotFoundException,
    ValidationException,
)
from app.interfaces.api.schemas import (
    ActionResponse,
    DocumentResponse,
)

router = APIRouter(tags=["documents"])
_doc_store = EncryptedDocumentStore()

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
}


@router.get(
    "/documents",
    response_model=list[DocumentResponse],
    operation_id="listDocuments",
    summary="List uploaded encrypted documents",
)
async def list_documents(
    current_owner: Owner = Depends(get_current_owner),
) -> list[DocumentResponse]:
    """Retrieve metadata of all documents uploaded by owner."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = (
            select(DocumentModel)
            .where(DocumentModel.owner_id == current_owner.id)
            .order_by(DocumentModel.created_at.desc())
        )
        rows = (await session.execute(stmt)).scalars().all()

    return [
        DocumentResponse(
            id=d.id,
            title=d.title,
            category=d.category,
            filename=d.filename,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
        )
        for d in rows
    ]


@router.post(
    "/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="uploadDocument",
    summary="Upload an encrypted document",
)
async def upload_document(
    file: UploadFile,
    title: str = Form(...),
    category: str = Form("general"),
    _idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_owner: Owner = Depends(get_current_owner),
) -> DocumentResponse:
    """Upload a new document with envelope encryption and metadata storage."""
    # 1. Content-type and filename validation
    content_type = file.content_type or "application/octet-stream"
    is_pdf_filename = bool(file.filename and file.filename.lower().endswith(".pdf"))
    if content_type not in ALLOWED_CONTENT_TYPES and not is_pdf_filename:
        raise ValidationException(
            "Unsupported file type. Only PDF, PNG, and JPEG documents are permitted."
        )

    # 2. Read content and size check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValidationException("File size exceeds 15 MB limit.")
    if len(content) == 0:
        raise ValidationException("Uploaded file cannot be empty.")

    doc_id = str(uuid.uuid4())
    filename = file.filename or "uploaded.pdf"

    # 3. Encrypt and save to storage
    size_bytes, sha256_hash, storage_path = _doc_store.save_encrypted(
        owner_id=current_owner.id,
        doc_id=doc_id,
        plaintext=content,
    )

    now = datetime.now(UTC)
    doc_model = DocumentModel(
        id=doc_id,
        owner_id=current_owner.id,
        title=title,
        category=category,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        sha256_hash=sha256_hash,
        storage_path=storage_path,
        created_at=now,
    )

    # 4. Save metadata and record audit event
    session_factory = get_session_factory()
    async with session_factory() as session:
        session.add(doc_model)
        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="DOCUMENT_UPLOADED",
            subject_type="DOCUMENT",
            subject_id=doc_id,
            metadata={"filename": filename, "size_bytes": size_bytes},
        )
        await session.commit()

    return DocumentResponse(
        id=doc_id,
        title=title,
        category=category,
        filename=filename,
        size_bytes=size_bytes,
        created_at=now,
    )


@router.delete(
    "/documents/{id}",
    response_model=ActionResponse,
    operation_id="deleteDocument",
    summary="Delete an uploaded document",
)
async def delete_document(
    id: str,
    current_owner: Owner = Depends(get_current_owner),
) -> ActionResponse:
    """Delete document by ID with cross-user isolation."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        stmt = select(DocumentModel).where(DocumentModel.id == id)
        doc = (await session.execute(stmt)).scalar_one_or_none()
        if not doc or doc.owner_id != current_owner.id:
            raise NotFoundException("Document not found.")

        storage_path = doc.storage_path
        await session.delete(doc)

        await record_audit_event(
            session=session,
            actor_type="OWNER",
            actor_id=current_owner.id,
            action="DOCUMENT_DELETED",
            subject_type="DOCUMENT",
            subject_id=id,
        )
        await session.commit()

    _doc_store.delete_file(storage_path)
    return ActionResponse(message="Document deleted successfully.")
