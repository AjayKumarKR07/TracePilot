from datetime import datetime, timezone, timedelta
from typing import Sequence
from fastapi import HTTPException, status
from sqlalchemy import select, func, case, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sprint import Sprint, SprintStatus
from app.models.issue import Issue, IssueStatus
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.sprint import (
    SprintCreate, SprintUpdate, SprintAnalytics, SprintOverview, SprintRead,
    SprintAssignTester, SprintRequestChanges
)
from app.services.audit_service import create_audit_log
from app.models.audit_log import AuditAction
from app.services import notification_service
from app.models.notification import NotificationType
from app.schemas.notification import NotificationResponse
import logging
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

async def _broadcast_ws_notification(user_id: int | None, notif) -> None:
    """Safely format and broadcast a real-time notification to user's active WebSockets."""
    if not user_id or not notif:
        return
    try:
        if isinstance(notif, dict):
            data = notif
        elif isinstance(notif, NotificationResponse):
            data = notif.model_dump(mode="json")
        else:
            data = NotificationResponse.model_validate(notif).model_dump(mode="json")
        payload = {
            "type": "notification",
            "data": data,
        }
        await ws_manager.send_personal_notification(user_id, payload)
    except Exception as exc:
        logger.warning("WS dispatch error for user %s: %s", user_id, exc)

# Statuses that count as "active/in-flight" for burndown/health purposes
_ACTIVE_STATUSES = {
    SprintStatus.ACTIVE,
    SprintStatus.IN_PROGRESS,
    SprintStatus.READY_FOR_APPROVAL,
}


async def get_sprints_for_project(db: AsyncSession, project_id: int) -> Sequence[SprintRead]:
    result = await db.execute(
        select(Sprint)
        .options(
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.submitted_by),
            selectinload(Sprint.approved_by),
            selectinload(Sprint.project),
            selectinload(Sprint.issues).selectinload(Issue.assignee),
        )
        .where(Sprint.project_id == project_id)
        .order_by(Sprint.id.desc())
    )
    sprints = result.scalars().all()
    enriched: list[SprintRead] = []
    for s in sprints:
        sr = SprintRead.model_validate(s)
        try:
            analytics = await get_sprint_analytics(db, s.id)
            sr.burndown_points = analytics.burndown_points
            sr.burndown_data = analytics.burndown_points
            sr.workload = analytics.workload
            sr.workload_distribution = analytics.workload
            sr.velocity = analytics.completed_issues
        except Exception:
            pass
        enriched.append(sr)
    return enriched


async def get_sprint_by_id(db: AsyncSession, sprint_id: int) -> Sprint:
    result = await db.execute(
        select(Sprint)
        .options(
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.submitted_by),
            selectinload(Sprint.approved_by),
            selectinload(Sprint.project),
            selectinload(Sprint.issues).selectinload(Issue.assignee),
        )
        .where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    return sprint


async def get_sprint_details(db: AsyncSession, sprint_id: int) -> SprintRead:
    sprint = await get_sprint_by_id(db, sprint_id)
    sr = SprintRead.model_validate(sprint)
    try:
        analytics = await get_sprint_analytics(db, sprint_id)
        sr.burndown_points = analytics.burndown_points
        sr.burndown_data = analytics.burndown_points
        sr.workload = analytics.workload
        sr.workload_distribution = analytics.workload
        sr.velocity = analytics.completed_issues
    except Exception as e:
        logger.warning("Failed to enrich sprint %s with analytics: %s", sprint_id, e)
    return sr


async def create_sprint(db: AsyncSession, sprint_in: SprintCreate, actor: User | None = None) -> Sprint:
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == sprint_in.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if sprint_in.end_date <= sprint_in.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint end date must be after start date"
        )
        
    # Ensure name uniqueness within the project
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == sprint_in.project_id, Sprint.name == sprint_in.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A sprint with this name already exists in the project"
        )

    sprint = Sprint(
        name=sprint_in.name.strip(),
        goal=sprint_in.goal,
        start_date=sprint_in.start_date,
        end_date=sprint_in.end_date,
        project_id=sprint_in.project_id,
        status=SprintStatus.PLANNED,
        estimated_team_members=sprint_in.estimated_team_members,
        working_days=sprint_in.working_days,
        hours_per_day=sprint_in.hours_per_day,
    )
    db.add(sprint)
    await db.flush()

    # Assign issues if provided
    if sprint_in.issue_ids:
        issue_result = await db.execute(
            select(Issue).where(Issue.id.in_(sprint_in.issue_ids))
        )
        issues = issue_result.scalars().all()
        if len(issues) != len(sprint_in.issue_ids):
            found_ids = {i.id for i in issues}
            missing_ids = list(set(sprint_in.issue_ids) - found_ids)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Issues with IDs {missing_ids} not found."
            )
        for issue in issues:
            if issue.project_id != sprint.project_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign issue {issue.issue_key} to sprint '{sprint.name}': issue belongs to project {issue.project_id}, but sprint belongs to project {sprint.project_id}."
                )
            issue.sprint_id = sprint.id
            if actor:
                await create_audit_log(
                    db=db, actor=actor, action=AuditAction.ISSUE_UPDATED,
                    entity_type="ISSUE", entity_id=issue.id, entity_key=issue.issue_key,
                    description=f"Issue assigned to Sprint '{sprint.name}' on creation"
                )

    if actor:
        await create_audit_log(
            db=db, actor=actor, action=AuditAction.SPRINT_CREATED,
            entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
            description=f"Created sprint '{sprint.name}'"
        )

    await db.commit()
    await db.refresh(sprint)
    return sprint


async def update_sprint(db: AsyncSession, sprint_id: int, sprint_in: SprintUpdate, actor: User | None = None) -> Sprint:
    sprint = await get_sprint_by_id(db, sprint_id)

    if sprint_in.name and sprint_in.name.strip() != sprint.name:
        # Ensure name uniqueness within the project
        result = await db.execute(
            select(Sprint).where(Sprint.project_id == sprint.project_id, Sprint.name == sprint_in.name.strip())
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A sprint with this name already exists in the project"
            )

    update_data = sprint_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

    if "status" in update_data and update_data["status"] == SprintStatus.ACTIVE and sprint.status != SprintStatus.ACTIVE:
        result = await db.execute(
            select(Sprint).where(
                Sprint.project_id == sprint.project_id,
                Sprint.status == SprintStatus.ACTIVE,
                Sprint.id != sprint.id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another sprint is already active for this project."
            )

    if "status" in update_data and update_data["status"] == SprintStatus.COMPLETED:
        total_res = await db.execute(
            select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
        )
        total_issues = total_res.scalar() or 0
        completed_res = await db.execute(
            select(func.count(Issue.id)).where(
                Issue.sprint_id == sprint.id,
                Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED])
            )
        )
        completed_issues = completed_res.scalar() or 0
        if total_issues == 0 or completed_issues < total_issues:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sprint cannot be completed. Resolve all assigned sprint issues before approval."
            )

    for field, value in update_data.items():
        setattr(sprint, field, value)

    # Validate dates if they were updated
    if sprint.end_date <= sprint.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint end date must be after start date"
        )

    if actor:
        await create_audit_log(
            db=db, actor=actor, action=AuditAction.SPRINT_UPDATED,
            entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
            description=f"Updated sprint '{sprint.name}'"
        )

    await db.commit()
    await db.refresh(sprint)
    return sprint


async def start_sprint(db: AsyncSession, sprint_id: int, actor: User) -> Sprint:
    sprint = await get_sprint_by_id(db, sprint_id)
    
    if sprint.status == SprintStatus.ACTIVE:
        return sprint

    if sprint.status != SprintStatus.PLANNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sprint cannot be started because it is in {sprint.status} state"
        )
        
    # Check if another sprint is already ACTIVE
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == sprint.project_id, Sprint.status == SprintStatus.ACTIVE)
    )
    active_sprint = result.scalar_one_or_none()
    if active_sprint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Another sprint is already active for this project."
        )

    sprint.status = SprintStatus.ACTIVE
    sprint.actual_start_date = datetime.now(timezone.utc)
    
    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_STARTED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Started sprint '{sprint.name}'"
    )

    admin_result = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = admin_result.scalars().all()
    notifications = await notification_service.notify_users(
        db=db, user_ids=admin_ids, notification_type=NotificationType.SPRINT_STARTED,
        title="Sprint Started", message=f"Sprint '{sprint.name}' has been started by {actor.full_name}.",
        actor_id=actor.id, entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name
    )

    tester_notif = None
    if sprint.assigned_tester_id:
        tester_notif = await notification_service.create_notification(
            db=db,
            user_id=sprint.assigned_tester_id,
            notification_type=NotificationType.SPRINT_STARTED,
            title="Sprint Started",
            message=f"Sprint '{sprint.name}' has been started by {actor.full_name}.",
            entity_type="SPRINT",
            entity_id=sprint.id,
            entity_key=sprint.name,
        )

    await db.commit()
    
    # Broadcast to connected admins
    for notif in notifications:
        await _broadcast_ws_notification(notif.user_id, notif)
    if tester_notif and sprint.assigned_tester_id:
        await _broadcast_ws_notification(sprint.assigned_tester_id, tester_notif)

    await db.refresh(sprint)
    return sprint


async def complete_sprint(db: AsyncSession, sprint_id: int, move_remaining_to_sprint_id: int | None, actor: User) -> Sprint:
    sprint = await get_sprint_by_id(db, sprint_id)
    
    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active sprints can be completed"
        )

    # Ensure sprint cannot be completed if total_issues == 0
    total_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    total_issues = total_res.scalar() or 0
    if total_issues == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint cannot be completed. Resolve all assigned sprint issues before approval."
        )

    # Get unresolved issues
    result = await db.execute(
        select(Issue).where(
            Issue.sprint_id == sprint.id,
            Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.CLOSED])
        )
    )
    unresolved_issues = result.scalars().all()
    
    if move_remaining_to_sprint_id:
        target_sprint = await get_sprint_by_id(db, move_remaining_to_sprint_id)
        if target_sprint.project_id != sprint.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target sprint belongs to a different project"
            )
        new_sprint_id = target_sprint.id
        dest_name = f"Sprint '{target_sprint.name}'"
    else:
        new_sprint_id = None
        dest_name = "Backlog"

    for issue in unresolved_issues:
        issue.sprint_id = new_sprint_id
        await create_audit_log(
            db=db, actor=actor, action=AuditAction.ISSUE_UPDATED,
            entity_type="ISSUE", entity_id=issue.id, entity_key=issue.issue_key,
            description=f"Issue moved to {dest_name} on sprint completion"
        )

    sprint.status = SprintStatus.COMPLETED
    sprint.completed_at = datetime.now(timezone.utc)
    
    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_COMPLETED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Completed sprint '{sprint.name}'. Unresolved issues moved to {dest_name}."
    )

    admin_result = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = admin_result.scalars().all()
    notifications = await notification_service.notify_users(
        db=db, user_ids=admin_ids, notification_type=NotificationType.SPRINT_ENDED,
        title="Sprint Completed", message=f"Sprint '{sprint.name}' has been completed by {actor.full_name}.",
        actor_id=actor.id, entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name
    )

    tester_notif = None
    if sprint.assigned_tester_id:
        tester_notif = await notification_service.create_notification(
            db=db,
            user_id=sprint.assigned_tester_id,
            notification_type=NotificationType.SPRINT_ENDED,
            title="Sprint Completed",
            message=f"Sprint '{sprint.name}' has been completed by {actor.full_name}.",
            entity_type="SPRINT",
            entity_id=sprint.id,
            entity_key=sprint.name,
        )

    await db.commit()
    
    # Broadcast
    for notif in notifications:
        await _broadcast_ws_notification(notif.user_id, notif)
    if tester_notif and sprint.assigned_tester_id:
        await _broadcast_ws_notification(sprint.assigned_tester_id, tester_notif)

    await db.refresh(sprint)
    return sprint


async def delete_sprint(db: AsyncSession, sprint_id: int, actor: User) -> None:
    sprint = await get_sprint_by_id(db, sprint_id)
    # Status Guard: Only PLANNED and COMPLETED sprints can be deleted.
    # Non-terminal workflow states (ACTIVE, IN_PROGRESS, READY_FOR_APPROVAL, ARCHIVED) remain protected.
    if sprint.status not in (SprintStatus.PLANNED, SprintStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete a sprint in '{sprint.status.value}' status. Only PLANNED or COMPLETED sprints can be deleted."
        )

    # Capture sprint and tester info before deleting sprint record
    assigned_tester_id = sprint.assigned_tester_id
    sprint_name = sprint.name
    sprint_id_val = sprint.id
    was_completed = (sprint.status == SprintStatus.COMPLETED)

    # Safely detach linked issues (issue.sprint_id = None).
    # All issue records, statuses, resolutions, comments, attachments, and histories are preserved!
    result = await db.execute(select(Issue).where(Issue.sprint_id == sprint.id))
    unassigned_issues = result.scalars().all()
    for issue in unassigned_issues:
        issue.sprint_id = None
        await create_audit_log(
            db=db, actor=actor, action=AuditAction.ISSUE_UPDATED,
            entity_type="ISSUE", entity_id=issue.id, entity_key=issue.issue_key,
            description=f"Issue unassigned from deleted sprint '{sprint_name}' (defect data preserved)"
        )
    sprint.issues = []
    await db.flush()

    # If sprint had an assigned tester, verify tester exists and create notification
    tester_notif = None
    if assigned_tester_id:
        tester_user = await db.scalar(select(User).where(User.id == assigned_tester_id, User.is_active == True))
        if tester_user:
            title = "Sprint Deleted" if was_completed else "Planned Sprint Deleted"
            message = (
                f"Completed sprint '{sprint_name}' was removed by Administrator {actor.full_name}. "
                "All defect records, comments, attachments, and resolutions have been preserved."
                if was_completed
                else f"Planned sprint '{sprint_name}' was deleted by Administrator {actor.full_name}."
            )
            tester_notif = await notification_service.create_notification(
                db=db,
                user_id=assigned_tester_id,
                notification_type=NotificationType.SPRINT_ENDED,
                title=title,
                message=message,
                entity_type="SPRINT",
                entity_id=sprint_id_val,
                entity_key=sprint_name,
            )

    # Delete sprint record from DB & log audit
    await db.delete(sprint)
    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_DELETED,
        entity_type="SPRINT", entity_id=sprint_id_val, entity_key=sprint_name,
        description=f"Deleted sprint '{sprint_name}'"
    )
    await db.commit()

    # Broadcast real-time notification to assigned tester
    if assigned_tester_id and tester_notif:
        await _broadcast_ws_notification(assigned_tester_id, tester_notif)

async def archive_sprint(db: AsyncSession, sprint_id: int, actor: User) -> Sprint:
    sprint = await get_sprint_by_id(db, sprint_id)
    if sprint.status != SprintStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only completed sprints can be archived")
        
    sprint.status = SprintStatus.ARCHIVED
    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_ARCHIVED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Archived sprint '{sprint.name}'"
    )
    await db.commit()
    await db.refresh(sprint)
    return sprint

async def extend_sprint(db: AsyncSession, sprint_id: int, new_end_date: datetime, actor: User) -> Sprint:
    sprint = await get_sprint_by_id(db, sprint_id)
    if sprint.status not in [SprintStatus.ACTIVE, SprintStatus.PLANNED]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only extend ACTIVE or PLANNED sprints")
        
    if new_end_date <= sprint.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New end date must be after current end date")
        
    sprint.end_date = new_end_date
    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_EXTENDED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Extended sprint '{sprint.name}' to {new_end_date.strftime('%Y-%m-%d')}"
    )
    await db.commit()
    await db.refresh(sprint)
    return sprint

async def get_project_sprint_summary(db: AsyncSession, project_id: int) -> SprintOverview:
    sprints = await get_sprints_for_project(db, project_id)
    
    total = len(sprints)
    completed_sprints = [s for s in sprints if s.status in [SprintStatus.COMPLETED, SprintStatus.ARCHIVED]]
    active_sprint = next((s for s in sprints if s.status in _ACTIVE_STATUSES), None)
    
    now = datetime.now(timezone.utc)
    overdue_count = sum(1 for s in sprints if s.status in _ACTIVE_STATUSES and s.end_date < now)
    
    avg_comp_rate = 0.0
    avg_velocity = 0.0
    
    if completed_sprints:
        total_comp_rate = 0.0
        total_completed_issues = 0
        for s in completed_sprints:
            # Note: This is an approximation as calculating exact for each could be slow.
            # In a real app we might store these stats. We'll compute it via DB for all completed.
            pass
            
        # Optimize: get completion stats for all completed sprints in one query
        sprint_ids = [s.id for s in completed_sprints]
        stats_query = select(
            Issue.sprint_id,
            func.count().label("total"),
            func.count(case((Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED]), 1))).label("completed")
        ).where(Issue.sprint_id.in_(sprint_ids)).group_by(Issue.sprint_id)
        
        stats_res = await db.execute(stats_query)
        stats = stats_res.all()
        
        rates = []
        velos = []
        for row in stats:
            rate = (row.completed / row.total * 100) if row.total > 0 else 0
            rates.append(rate)
            velos.append(row.completed)
            
        if rates:
            avg_comp_rate = sum(rates) / len(rates)
            avg_velocity = sum(velos) / len(velos)

    return SprintOverview(
        total_sprints=total,
        active_sprint=SprintRead.model_validate(active_sprint) if active_sprint else None,
        completed_sprints=len(completed_sprints),
        avg_completion_rate=round(avg_comp_rate, 2),
        avg_velocity=round(avg_velocity, 2),
        overdue_sprints=overdue_count
    )

async def get_sprint_analytics(db: AsyncSession, sprint_id: int) -> SprintAnalytics:
    sprint = await get_sprint_by_id(db, sprint_id)
    
    issue_query = select(
        func.count().label("total"),
        func.count(
            case((Issue.status.in_([IssueStatus.REPORTED, IssueStatus.TRIAGED, IssueStatus.ASSIGNED, IssueStatus.REOPENED]), 1))
        ).label("open"),
        func.count(
            case((Issue.status.in_([IssueStatus.IN_DEVELOPMENT, IssueStatus.IN_REVIEW, IssueStatus.IN_TESTING]), 1))
        ).label("in_progress"),
        func.count(case((Issue.status == IssueStatus.RESOLVED, 1))).label("resolved"),
        func.count(case((Issue.status == IssueStatus.CLOSED, 1))).label("closed"),
        func.sum(Issue.estimated_effort).label("total_effort"),
        func.sum(case((Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED]), Issue.estimated_effort), else_=0)).label("completed_effort"),
    ).select_from(Issue).where(Issue.sprint_id == sprint_id)
    
    row = (await db.execute(issue_query)).one()
    
    total = row.total or 0
    completed_issues = (row.resolved or 0) + (row.closed or 0)
    remaining_issues = (row.open or 0) + (row.in_progress or 0)
    completion_rate = round((completed_issues / total * 100.0), 2) if total > 0 else 0.0
    
    total_effort = row.total_effort or 0
    completed_effort = row.completed_effort or 0
    remaining_effort = total_effort - completed_effort

    capacity = None
    if sprint.estimated_team_members and sprint.working_days and sprint.hours_per_day:
        capacity = sprint.estimated_team_members * sprint.working_days * sprint.hours_per_day

    now = datetime.now(timezone.utc)
    is_overdue = sprint.status == SprintStatus.ACTIVE and sprint.end_date < now
    days_overdue = (now - sprint.end_date).days if is_overdue else 0
    
    sprint_health = "ON_TRACK"
    if is_overdue:
        sprint_health = "OFF_TRACK"
    elif sprint.status in _ACTIVE_STATUSES:
        days_total = max(1, (sprint.end_date - sprint.start_date).days)
        days_elapsed = (now - sprint.start_date).days
        time_elapsed_pct = max(0.0, min(1.0, days_elapsed / days_total))
        
        if total > 0:
            if completion_rate < (time_elapsed_pct * 100) - 20:
                sprint_health = "OFF_TRACK"
            elif completion_rate < (time_elapsed_pct * 100) - 10:
                sprint_health = "AT_RISK"
                
    if sprint.status in [SprintStatus.COMPLETED, SprintStatus.ARCHIVED, SprintStatus.PLANNED]:
        sprint_health = None

    # Workload
    workload_query = (
        select(
            User.id,
            User.full_name,
            User.role,
            func.count(Issue.id).label("assigned_issues"),
            func.coalesce(func.sum(Issue.estimated_effort), 0).label("estimated_effort"),
            func.count(
                case(
                    (Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED]), 1)
                )
            ).label("completed_issues"),
            func.count(
                case(
                    (
                        Issue.status.in_(
                            [
                                IssueStatus.IN_DEVELOPMENT,
                                IssueStatus.IN_REVIEW,
                                IssueStatus.IN_TESTING,
                            ]
                        ),
                        1,
                    )
                )
            ).label("in_progress_issues"),
            func.count(
                case(
                    (
                        Issue.status.in_(
                            [
                                IssueStatus.REPORTED,
                                IssueStatus.TRIAGED,
                                IssueStatus.ASSIGNED,
                                IssueStatus.REOPENED,
                            ]
                        ),
                        1,
                    )
                )
            ).label("open_issues"),
        )
        .select_from(Issue)
        .join(User, Issue.assignee_id == User.id)
        .where(Issue.sprint_id == sprint_id)
        .group_by(User.id, User.full_name, User.role)
    )

    wl_result = await db.execute(workload_query)
    workload = []
    seen_user_ids = set()
    for wl in wl_result.all():
        seen_user_ids.add(wl.id)
        assigned_cnt = wl.assigned_issues or 0
        comp_cnt = wl.completed_issues or 0
        rem_cnt = max(0, assigned_cnt - comp_cnt)
        role_name = wl.role.value if hasattr(wl.role, "value") else str(wl.role)
        workload.append({
            "tester_id": wl.id,
            "tester_name": wl.full_name,
            "developer_id": wl.id,
            "developer_name": wl.full_name,
            "role": role_name,
            "assigned_issues": assigned_cnt,
            "estimated_effort": int(wl.estimated_effort or 0),
            "completed_issues": comp_cnt,
            "in_progress_issues": wl.in_progress_issues or 0,
            "open_issues": wl.open_issues or 0,
            "remaining_issues": rem_cnt,
            "workload_percentage": round((assigned_cnt / total * 100.0), 1) if total > 0 else 0.0,
        })

    # If assigned tester exists and has 0 issues in this sprint, show them explicitly
    if sprint.assigned_tester_id and sprint.assigned_tester_id not in seen_user_ids:
        tester_user = await db.get(User, sprint.assigned_tester_id)
        if tester_user:
            seen_user_ids.add(tester_user.id)
            t_role = tester_user.role.value if hasattr(tester_user.role, "value") else str(tester_user.role)
            workload.append({
                "tester_id": tester_user.id,
                "tester_name": tester_user.full_name,
                "developer_id": tester_user.id,
                "developer_name": tester_user.full_name,
                "role": t_role,
                "assigned_issues": 0,
                "estimated_effort": 0,
                "completed_issues": 0,
                "in_progress_issues": 0,
                "open_issues": 0,
                "remaining_issues": 0,
                "workload_percentage": 0.0,
            })

    # Ensure all allocated sprint team members (e.g. 5 members) are represented in Workload Distribution
    target_members = sprint.estimated_team_members or 5
    if len(workload) < target_members:
        needed = target_members - len(workload)
        extra_users_res = await db.execute(
            select(User)
            .where(
                User.is_active == True,
                User.role == UserRole.DEVELOPER,
                User.id.notin_(seen_user_ids)
            )
            .order_by(User.id)
            .limit(needed)
        )
        for u in extra_users_res.scalars().all():
            seen_user_ids.add(u.id)
            u_role = u.role.value if hasattr(u.role, "value") else str(u.role)
            workload.append({
                "tester_id": u.id,
                "tester_name": u.full_name,
                "developer_id": u.id,
                "developer_name": u.full_name,
                "role": u_role,
                "assigned_issues": 0,
                "estimated_effort": 0,
                "completed_issues": 0,
                "in_progress_issues": 0,
                "open_issues": 0,
                "remaining_issues": 0,
                "workload_percentage": 0.0,
            })

    # Real Historical Burndown Calculation
    burndown_points = []
    if sprint.status in (
        _ACTIVE_STATUSES | {SprintStatus.COMPLETED, SprintStatus.ARCHIVED}
    ) and total > 0:
        planned_start = sprint.start_date.date()
        planned_end = sprint.end_date.date()

        start_date_val = planned_start
        end_date_val = planned_end
        if sprint.status in (SprintStatus.COMPLETED, SprintStatus.ARCHIVED):
            if sprint.completed_at and sprint.completed_at.date() > planned_start:
                end_date_val = sprint.completed_at.date()

        total_days = max(1, (end_date_val - start_date_val).days)
        today_val = now.date()

        # Query all issues in this sprint with their resolution date
        issue_status_query = select(
            Issue.id,
            Issue.status,
            Issue.resolved_at,
            Issue.updated_at
        ).where(Issue.sprint_id == sprint_id)
        issues_res = await db.execute(issue_status_query)
        sprint_issues_list = issues_res.all()

        current_cutoff = min(today_val, end_date_val) if sprint.status in _ACTIVE_STATUSES else end_date_val
        day_count = max(1, (current_cutoff - start_date_val).days)

        for day_idx in range(day_count + 1):
            day_date = start_date_val + timedelta(days=day_idx)
            resolved_up_to_day = 0
            for iss in sprint_issues_list:
                if iss.status in [IssueStatus.RESOLVED, IssueStatus.CLOSED]:
                    res_date = (iss.resolved_at or iss.updated_at).date()
                    if res_date <= day_date:
                        resolved_up_to_day += 1

            ideal_remaining = max(0.0, round(total - (total / total_days) * day_idx, 1))

            if sprint.status in (SprintStatus.COMPLETED, SprintStatus.ARCHIVED) and day_idx == day_count:
                actual_remaining = total - completed_issues
            elif day_idx == 0:
                # Starting scope at sprint kickoff is non-zero
                actual_remaining = total
            else:
                actual_remaining = max(0, total - resolved_up_to_day)

            burndown_points.append({
                "date": day_date.strftime("%b %d"),
                "remaining": actual_remaining,
                "ideal": ideal_remaining
            })

    return SprintAnalytics(
        total_issues=total,
        completed_issues=completed_issues,
        remaining_issues=remaining_issues,
        completion_rate=completion_rate,
        open_issues=row.open,
        in_progress_issues=row.in_progress,
        resolved_issues=row.resolved,
        closed_issues=row.closed,
        total_capacity_hours=capacity,
        workload=workload,
        burndown_points=burndown_points,
        sprint_health=sprint_health,
        is_overdue=is_overdue,
        days_overdue=days_overdue,
        total_estimated_effort=total_effort,
        completed_effort=completed_effort,
        remaining_effort=remaining_effort
    )


async def add_issue_to_sprint(db: AsyncSession, sprint_id: int, issue_id: int, actor: User | None = None) -> Issue:
    sprint = await get_sprint_by_id(db, sprint_id)
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    
    if issue.project_id != sprint.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Issue and Sprint must belong to the same project"
        )

    issue.sprint_id = sprint.id
    
    if actor:
        await create_audit_log(
            db=db, actor=actor, action=AuditAction.ISSUE_UPDATED,
            entity_type="ISSUE", entity_id=issue.id, entity_key=issue.issue_key,
            description=f"Issue added to Sprint '{sprint.name}'"
        )

    tester_notif = None
    if sprint.assigned_tester_id and actor and sprint.assigned_tester_id != actor.id:
        tester_notif = await notification_service.create_notification(
            db=db,
            user_id=sprint.assigned_tester_id,
            notification_type=NotificationType.ISSUE_ASSIGNED,
            title="Issue Added to Sprint",
            message=f"Issue {issue.issue_key} was added to your sprint '{sprint.name}'.",
            entity_type="ISSUE",
            entity_id=issue.id,
            entity_key=issue.issue_key,
        )
        
    await db.commit()

    if tester_notif and sprint.assigned_tester_id:
        await _broadcast_ws_notification(sprint.assigned_tester_id, tester_notif)
    
    # Reload issue with relationships
    result = await db.execute(
        select(Issue)
        .options(selectinload(Issue.project), selectinload(Issue.reporter), selectinload(Issue.assignee))
        .where(Issue.id == issue_id)
    )
    return result.scalar_one()


async def remove_issue_from_sprint(db: AsyncSession, sprint_id: int, issue_id: int, actor: User | None = None) -> Issue:
    sprint = await get_sprint_by_id(db, sprint_id)
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")
    
    if issue.sprint_id != sprint.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Issue is not assigned to this sprint"
        )

    issue.sprint_id = None
    if actor:
        await create_audit_log(
            db=db, actor=actor, action=AuditAction.ISSUE_UPDATED,
            entity_type="ISSUE", entity_id=issue.id, entity_key=issue.issue_key,
            description=f"Issue removed from Sprint '{sprint.name}'"
        )

    tester_notif = None
    if sprint.assigned_tester_id and actor and sprint.assigned_tester_id != actor.id:
        tester_notif = await notification_service.create_notification(
            db=db,
            user_id=sprint.assigned_tester_id,
            notification_type=NotificationType.ISSUE_ASSIGNED,
            title="Issue Removed from Sprint",
            message=f"Issue {issue.issue_key} was removed from your sprint '{sprint.name}'.",
            entity_type="ISSUE",
            entity_id=issue.id,
            entity_key=issue.issue_key,
        )

    await db.commit()

    if tester_notif and sprint.assigned_tester_id:
        await _broadcast_ws_notification(sprint.assigned_tester_id, tester_notif)
    
    # Reload issue with relationships
    result = await db.execute(
        select(Issue)
        .options(selectinload(Issue.project), selectinload(Issue.reporter), selectinload(Issue.assignee))
        .where(Issue.id == issue_id)
    )
    return result.scalar_one()


# --------------------------------------------------------------------------- #
# Approval workflow functions                                                  #
# --------------------------------------------------------------------------- #

async def assign_tester(
    db: AsyncSession, sprint_id: int, tester_id: int, actor: User
) -> Sprint:
    """Assign a developer to a sprint. ADMIN only."""
    sprint = await get_sprint_by_id(db, sprint_id)

    # Validate developer exists and has DEVELOPER role
    developer_result = await db.execute(select(User).where(User.id == tester_id))
    developer = developer_result.scalar_one_or_none()
    if not developer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Developer user not found")
    if developer.role != UserRole.DEVELOPER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User '{developer.full_name}' does not have DEVELOPER role"
        )

    old_tester_id = sprint.assigned_tester_id
    sprint.assigned_tester_id = tester_id

    # Move PLANNED → ACTIVE automatically when developer is assigned
    if sprint.status == SprintStatus.PLANNED:
        sprint.status = SprintStatus.ACTIVE
        sprint.actual_start_date = datetime.now(timezone.utc)

    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_TESTER_ASSIGNED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Sprint '{sprint.name}' assigned to developer '{developer.full_name}'",
        old_values={"assigned_tester_id": old_tester_id},
        new_values={"assigned_tester_id": tester_id, "developer_name": developer.full_name},
    )

    # Real-time notification to assigned developer
    notif = await notification_service.create_notification(
        db=db,
        user_id=tester_id,
        notification_type=NotificationType.SPRINT_STARTED,
        title="Sprint assigned to you",
        message=f"Sprint '{sprint.name}' assigned to you by {actor.full_name}.",
        entity_type="SPRINT",
        entity_id=sprint.id,
        entity_key=sprint.name,
    )

    admin_res = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = [uid for uid in admin_res.scalars().all() if uid != actor.id]
    admin_notifs = await notification_service.notify_users(
        db=db,
        user_ids=admin_ids,
        notification_type=NotificationType.SPRINT_STARTED,
        title="Sprint Assigned",
        message=f"Sprint '{sprint.name}' assigned to developer '{developer.full_name}'.",
        actor_id=actor.id,
        entity_type="SPRINT",
        entity_id=sprint.id,
        entity_key=sprint.name,
    )

    await db.commit()

    await _broadcast_ws_notification(tester_id, notif)
    for an in admin_notifs:
        await _broadcast_ws_notification(an.user_id, an)

    return await get_sprint_by_id(db, sprint.id)


async def submit_for_approval(db: AsyncSession, sprint_id: int, actor: User) -> Sprint:
    """Tester submits a sprint for admin review."""
    sprint = await get_sprint_by_id(db, sprint_id)

    # Must be the assigned tester (or an admin acting on behalf)
    if actor.role == UserRole.DEVELOPER and sprint.assigned_tester_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned tester for this sprint"
        )

    # Only IN_PROGRESS â†’ READY_FOR_APPROVAL is allowed.
    # Tester must first use "Begin Work" (ACTIVE â†’ IN_PROGRESS) before submitting.
    if sprint.status != SprintStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Sprint cannot be submitted for approval from status '{sprint.status.value}'. "
                "Use 'Begin Work' first to move the sprint to IN_PROGRESS."
            )
        )

    # Sprint must contain at least 1 assigned issue before Submit for Approval
    issue_count_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    total_issues = issue_count_res.scalar() or 0
    if total_issues == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint cannot be submitted for approval with 0 issues. A sprint must contain at least 1 assigned issue before Submit for Approval."
        )

    old_status = sprint.status
    sprint.status = SprintStatus.READY_FOR_APPROVAL
    sprint.submitted_by_id = actor.id
    sprint.submitted_at = datetime.now(timezone.utc)
    sprint.review_comment = None  # clear previous rejection comment

    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_SUBMITTED_FOR_APPROVAL,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Tester '{actor.full_name}' submitted sprint '{sprint.name}' for admin approval",
        old_values={"status": old_status.value},
        new_values={"status": SprintStatus.READY_FOR_APPROVAL.value, "submitted_by": actor.full_name},
    )

    # Real-time notification to all active admins
    admin_res = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = admin_res.scalars().all()
    notifications = await notification_service.notify_users(
        db=db,
        user_ids=admin_ids,
        notification_type=NotificationType.SPRINT_ENDED,
        title="Sprint submitted for approval",
        message=f"Tester '{actor.full_name}' submitted sprint '{sprint.name}' for approval.",
        actor_id=actor.id,
        entity_type="SPRINT",
        entity_id=sprint.id,
        entity_key=sprint.name,
    )
    await db.commit()

    for n in notifications:
        await _broadcast_ws_notification(n.user_id, n)

    return await get_sprint_by_id(db, sprint.id)


async def approve_sprint(db: AsyncSession, sprint_id: int, actor: User) -> Sprint:
    """Admin approves a READY_FOR_APPROVAL sprint â†’ COMPLETED."""
    sprint = await get_sprint_by_id(db, sprint_id)

    if sprint.status != SprintStatus.READY_FOR_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sprint must be READY_FOR_APPROVAL to approve. Current status: '{sprint.status.value}'"
        )

    # Admin cannot approve if total_issues == 0 or completed_issues < total_issues
    total_res = await db.execute(
        select(func.count(Issue.id)).where(Issue.sprint_id == sprint.id)
    )
    total_issues = total_res.scalar() or 0

    completed_res = await db.execute(
        select(func.count(Issue.id)).where(
            Issue.sprint_id == sprint.id,
            Issue.status.in_([IssueStatus.RESOLVED, IssueStatus.CLOSED])
        )
    )
    completed_issues = completed_res.scalar() or 0

    if total_issues == 0 or completed_issues < total_issues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint cannot be completed. Resolve all assigned sprint issues before approval."
        )

    old_status = sprint.status
    sprint.status = SprintStatus.COMPLETED
    sprint.approved_by_id = actor.id
    sprint.approved_at = datetime.now(timezone.utc)
    sprint.completed_at = datetime.now(timezone.utc)

    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_APPROVED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Admin '{actor.full_name}' approved sprint '{sprint.name}'",
        old_values={"status": old_status.value},
        new_values={"status": SprintStatus.COMPLETED.value, "approved_by": actor.full_name},
    )

    notif = None
    if sprint.assigned_tester_id:
        notif = await notification_service.create_notification(
            db=db,
            user_id=sprint.assigned_tester_id,
            notification_type=NotificationType.SPRINT_ENDED,
            title="Sprint approved",
            message=f"Sprint '{sprint.name}' approved by {actor.full_name}!",
            entity_type="SPRINT",
            entity_id=sprint.id,
            entity_key=sprint.name,
        )

    admin_res = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = [uid for uid in admin_res.scalars().all() if uid != actor.id]
    admin_notifs = await notification_service.notify_users(
        db=db,
        user_ids=admin_ids,
        notification_type=NotificationType.SPRINT_ENDED,
        title="Sprint Approved",
        message=f"Sprint '{sprint.name}' approved by {actor.full_name}.",
        actor_id=actor.id,
        entity_type="SPRINT",
        entity_id=sprint.id,
        entity_key=sprint.name,
    )

    await db.commit()

    if notif and sprint.assigned_tester_id:
        await _broadcast_ws_notification(sprint.assigned_tester_id, notif)
    for an in admin_notifs:
        await _broadcast_ws_notification(an.user_id, an)

    return await get_sprint_by_id(db, sprint.id)


async def request_changes(
    db: AsyncSession, sprint_id: int, comment: str | None, actor: User
) -> Sprint:
    """Admin requests changes on a READY_FOR_APPROVAL sprint â†’ IN_PROGRESS."""
    sprint = await get_sprint_by_id(db, sprint_id)

    if sprint.status != SprintStatus.READY_FOR_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sprint must be READY_FOR_APPROVAL to request changes. Current status: '{sprint.status.value}'"
        )

    old_status = sprint.status
    sprint.status = SprintStatus.IN_PROGRESS
    sprint.review_comment = comment

    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_CHANGES_REQUESTED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Admin '{actor.full_name}' requested changes on sprint '{sprint.name}'",
        old_values={"status": old_status.value},
        new_values={"status": SprintStatus.IN_PROGRESS.value, "review_comment": comment},
    )

    notif = None
    if sprint.assigned_tester_id:
        msg = f"Changes requested for sprint '{sprint.name}'"
        if comment:
            msg += f": {comment}"
        notif = await notification_service.create_notification(
            db=db,
            user_id=sprint.assigned_tester_id,
            notification_type=NotificationType.SPRINT_STARTED,
            title="Changes requested for sprint",
            message=msg,
            entity_type="SPRINT",
            entity_id=sprint.id,
            entity_key=sprint.name,
        )

    admin_res = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = [uid for uid in admin_res.scalars().all() if uid != actor.id]
    admin_notifs = await notification_service.notify_users(
        db=db,
        user_ids=admin_ids,
        notification_type=NotificationType.SPRINT_STARTED,
        title="Sprint Changes Requested",
        message=f"Changes requested on sprint '{sprint.name}' by {actor.full_name}.",
        actor_id=actor.id,
        entity_type="SPRINT",
        entity_id=sprint.id,
        entity_key=sprint.name,
    )

    await db.commit()

    if notif and sprint.assigned_tester_id:
        await _broadcast_ws_notification(sprint.assigned_tester_id, notif)
    for an in admin_notifs:
        await _broadcast_ws_notification(an.user_id, an)

    return await get_sprint_by_id(db, sprint.id)


async def get_assigned_sprints_for_tester(
    db: AsyncSession, tester_id: int
) -> Sequence[Sprint]:
    """Return all sprints assigned to a specific tester, ordered by most recent first."""
    result = await db.execute(
        select(Sprint)
        .options(
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.submitted_by),
            selectinload(Sprint.approved_by),
            selectinload(Sprint.project),
            selectinload(Sprint.issues).selectinload(Issue.assignee),
        )
        .where(Sprint.assigned_tester_id == tester_id)
        .order_by(Sprint.updated_at.desc())
    )
    return [SprintRead.model_validate(s) for s in result.scalars().all()]


async def get_sprints_awaiting_approval(db: AsyncSession) -> Sequence[Sprint]:
    """Return all sprints in READY_FOR_APPROVAL status, oldest submission first."""
    result = await db.execute(
        select(Sprint)
        .options(
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.submitted_by),
            selectinload(Sprint.approved_by),
            selectinload(Sprint.project),
            selectinload(Sprint.issues).selectinload(Issue.assignee),
        )
        .where(Sprint.status == SprintStatus.READY_FOR_APPROVAL)
        .order_by(Sprint.submitted_at.asc())
    )
    return [SprintRead.model_validate(s) for s in result.scalars().all()]


async def get_active_sprints(db: AsyncSession) -> Sequence[Sprint]:
    """Return all ACTIVE and IN_PROGRESS sprints, ordered by start date desc."""
    result = await db.execute(
        select(Sprint)
        .options(
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.submitted_by),
            selectinload(Sprint.approved_by),
            selectinload(Sprint.project),
            selectinload(Sprint.issues).selectinload(Issue.assignee),
        )
        .where(Sprint.status.in_([SprintStatus.ACTIVE, SprintStatus.IN_PROGRESS]))
        .order_by(Sprint.start_date.desc())
    )
    return [SprintRead.model_validate(s) for s in result.scalars().all()]


async def get_all_sprints(
    db: AsyncSession, project_id: int | None = None, status: SprintStatus | None = None
) -> Sequence[Sprint]:
    """Return all sprints with optional project_id and status filters."""
    query = (
        select(Sprint)
        .options(
            selectinload(Sprint.assigned_tester),
            selectinload(Sprint.submitted_by),
            selectinload(Sprint.approved_by),
            selectinload(Sprint.project),
            selectinload(Sprint.issues).selectinload(Issue.assignee),
        )
        .order_by(Sprint.id.desc())
    )
    if project_id is not None:
        query = query.where(Sprint.project_id == project_id)
    if status is not None:
        query = query.where(Sprint.status == status)
    result = await db.execute(query)
    return [SprintRead.model_validate(s) for s in result.scalars().all()]




async def begin_work(
    db: AsyncSession, sprint_id: int, actor: User
) -> Sprint:
    """Tester begins work on an ACTIVE sprint â†’ IN_PROGRESS."""
    sprint = await get_sprint_by_id(db, sprint_id)

    # Only the assigned tester (or admin) may begin work
    if actor.role == UserRole.DEVELOPER and sprint.assigned_tester_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned tester for this sprint"
        )

    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sprint must be ACTIVE to begin work. Current status: '{sprint.status.value}'"
        )

    old_status = sprint.status
    sprint.status = SprintStatus.IN_PROGRESS

    await create_audit_log(
        db=db, actor=actor, action=AuditAction.SPRINT_UPDATED,
        entity_type="SPRINT", entity_id=sprint.id, entity_key=sprint.name,
        description=f"Tester '{actor.full_name}' began work on sprint '{sprint.name}'",
        old_values={"status": old_status.value},
        new_values={"status": SprintStatus.IN_PROGRESS.value},
    )
    admin_res = await db.execute(select(User.id).where(User.role == UserRole.ADMIN, User.is_active == True))
    admin_ids = admin_res.scalars().all()
    notifications = await notification_service.notify_users(
        db=db,
        user_ids=admin_ids,
        notification_type=NotificationType.SPRINT_STARTED,
        title="Sprint In Progress",
        message=f"Tester '{actor.full_name}' began work on sprint '{sprint.name}'.",
        actor_id=actor.id,
        entity_type="SPRINT",
        entity_id=sprint.id,
        entity_key=sprint.name,
    )

    await db.commit()

    for n in notifications:
        await _broadcast_ws_notification(n.user_id, n)

    return await get_sprint_by_id(db, sprint.id)

