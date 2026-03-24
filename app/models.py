"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional


class AccessRequestCreate(BaseModel):
    requester: str = Field(..., description="Name of the person requesting access")
    requester_email: Optional[str] = Field(None, description="Email for notifications")
    jumpserver_user: str = Field(..., description="JumpServer username to grant access to")
    asset_hostname: str = Field(..., description="Target asset hostname in JumpServer")
    accounts: str = Field(
        default="@ALL",
        description="Comma-separated account names, or @ALL for all accounts",
    )
    reason: str = Field(..., min_length=10, description="Business justification")
    duration_minutes: int = Field(
        default=120, ge=15, le=480, description="Access duration in minutes"
    )


class AccessRequestResponse(BaseModel):
    id: str
    requester: str
    requester_email: Optional[str]
    jumpserver_user: str
    asset_hostname: str
    accounts: str
    reason: str
    duration_minutes: int
    status: str
    reviewer: Optional[str]
    review_comment: Optional[str]
    reviewed_at: Optional[str]
    permission_id: Optional[str]
    permission_name: Optional[str]
    access_start: Optional[str]
    access_expiry: Optional[str]
    created_at: str
    updated_at: str


class ReviewAction(BaseModel):
    reviewer: str = Field(..., description="Name of the reviewer")
    comment: Optional[str] = Field(default="", description="Review comment")


class DashboardStats(BaseModel):
    total_requests: int
    active_grants: int
    pending_approvals: int
    status_breakdown: dict
