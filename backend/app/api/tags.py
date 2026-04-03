from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tag import Tag
from app.models.user import User
from app.schemas.tag import TagCreate, TagResponse, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
def list_tags(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Tag).where(Tag.user_id == current_user.id).order_by(Tag.label.asc())).all()


@router.post("", response_model=TagResponse)
def create_tag(payload: TagCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tag = Tag(label=payload.label.strip(), user_id=current_user.id)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: int, payload: TagUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id))
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    tag.label = payload.label.strip()
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id))
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    db.delete(tag)
    db.commit()
    return {"ok": True}
