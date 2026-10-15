"""API routers package."""

from app.interfaces.api.routers.accounts import router as accounts_router
from app.interfaces.api.routers.auth import router as auth_router
from app.interfaces.api.routers.bank_accounts import router as bank_accounts_router
from app.interfaces.api.routers.contacts import router as contacts_router
from app.interfaces.api.routers.documents import router as documents_router
from app.interfaces.api.routers.health import router as health_router
from app.interfaces.api.routers.loans import router as loans_router
from app.interfaces.api.routers.monitor import router as monitor_router
from app.interfaces.api.routers.mutual_funds import router as mutual_funds_router
from app.interfaces.api.routers.notifications import router as notifications_router
from app.interfaces.api.routers.packet import router as packet_router
from app.interfaces.api.routers.stock_websocket import router as stock_ws_router

__all__ = [
    "accounts_router",
    "auth_router",
    "bank_accounts_router",
    "contacts_router",
    "documents_router",
    "health_router",
    "loans_router",
    "monitor_router",
    "mutual_funds_router",
    "notifications_router",
    "packet_router",
    "stock_ws_router",
]
