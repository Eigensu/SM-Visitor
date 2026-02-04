"""
Pydantic models for MongoDB documents
These models provide validation and serialization for database operations
"""
from pydantic import BaseModel, Field
from typing import Optional, Any, List
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class UserModel(BaseModel):
    """User document model"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    phone: str
    role: str  # owner, guard, admin
    flat_id: Optional[str] = None
    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[dict[str, Any]] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class VisitorModel(BaseModel):
    """Visitor document model"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    phone: Optional[str] = None
    photo_url: str
    visitor_type: str  # regular, new, temporary
    created_by: str  # User ID
    default_purpose: Optional[str] = None
    qr_token: Optional[str] = None
    qr_expires_at: Optional[datetime] = None
    is_all_flats: bool = False
    valid_flats: Optional[List[str]] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[dict[str, Any]] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class VisitModel(BaseModel):
    """Visit document model"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    visitor_id: Optional[str] = None
    name_snapshot: str
    phone_snapshot: Optional[str] = None
    photo_snapshot_url: str
    purpose: str
    owner_id: str
    guard_id: str
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    status: str  # pending, approved, rejected, auto_approved
    qr_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class TemporaryQRModel(BaseModel):
    """Temporary QR document model"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    owner_id: str
    guest_name: Optional[str] = None
    token: str
    expires_at: datetime
    one_time: bool = True
    is_all_flats: bool = False
    valid_flats: Optional[List[str]] = None
    used_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
