from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.models.sprint import SprintStatus


class SprintBase(BaseModel):
    name: str = Field(..., max_length=200, example="Sprint 1")
    goal: str | None = Field(None, example="Finish login flow")
    start_date: datetime
    end_date: datetime
    estimated_team_members: int | None = Field(None, ge=1)
    working_days: int | None = Field(None, ge=1)
    hours_per_day: int | None = Field(None, ge=1)
    goal_status: str = Field("NOT_STARTED", max_length=50)


class SprintCreate(SprintBase):
    project_id: int
    issue_ids: list[int] | None = Field(None, description="Issues to assign to sprint on creation")
    developer_id: int | None = Field(None, description="Developer to assign to sprint on creation")
    assigned_developer_id: int | None = Field(None, description="Alias for developer_id")


class SprintUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    goal: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: SprintStatus | None = None
    estimated_team_members: int | None = None
    working_days: int | None = None
    hours_per_day: int | None = None
    goal_status: str | None = Field(None, max_length=50)
    project_id: int | None = Field(None, description="Project ID (only editable if sprint has 0 assigned issues)")

class SprintExtend(BaseModel):
    new_end_date: datetime


# ── Approval workflow request schemas ─────────────────────────────────────────

class SprintAssignTester(BaseModel):
    developer_id: int | None = Field(None, description="ID of the DEVELOPER user to assign")
    tester_id: int | None = Field(None, description="Legacy alias for developer_id")

    def get_assignee_id(self) -> int:
        target = self.developer_id or self.tester_id
        if target is None:
            raise ValueError("developer_id or tester_id is required.")
        return target


SprintAssignDeveloper = SprintAssignTester


class SprintRequestChanges(BaseModel):
    comment: str | None = Field(None, max_length=2000, description="Optional reason/feedback for the developer")


# ── Read schema ───────────────────────────────────────────────────────────────

class SprintRead(SprintBase):
    id: int
    project_id: int
    status: SprintStatus
    actual_start_date: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # Approval workflow fields
    assigned_tester_id: int | None = None
    assigned_tester_name: str | None = None   # resolved from relationship
    assigned_developer_id: int | None = None
    assigned_developer_name: str | None = None
    submitted_by_id: int | None = None
    submitted_at: datetime | None = None
    approved_by_id: int | None = None
    approved_at: datetime | None = None
    review_comment: str | None = None
    # Rich project & progress metrics
    project_name: str | None = None
    project_key: str | None = None
    total_issues: int = 0
    completed_issues: int = 0
    remaining_issues: int = 0
    progress_percentage: int = 0
    total_estimated_effort: int = 0
    completed_estimated_effort: int = 0
    velocity: int = 0
    burndown_points: list[dict] = Field(default_factory=list)
    burndown_data: list[dict] = Field(default_factory=list)
    workload: list[dict] = Field(default_factory=list)
    workload_distribution: list[dict] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        try:
            from sqlalchemy import inspect as sa_inspect
            insp = sa_inspect(obj, raiseerr=False)
            unloaded = insp.unloaded if insp else set()

            if "assigned_tester" not in unloaded:
                dev = getattr(obj, "assigned_tester", None)
                if dev and hasattr(dev, "full_name"):
                    instance.assigned_tester_name = dev.full_name
                    instance.assigned_developer_name = dev.full_name
                    instance.assigned_developer_id = dev.id
            if instance.assigned_tester_id and not instance.assigned_developer_id:
                instance.assigned_developer_id = instance.assigned_tester_id

            if "project" not in unloaded:
                proj = getattr(obj, "project", None)
                if proj:
                    instance.project_name = getattr(proj, "name", None)
                    instance.project_key = getattr(proj, "project_key", None)

            if "issues" not in unloaded:
                issues = getattr(obj, "issues", None)
                if issues is not None:
                    tot = len(issues)
                    comp = 0
                    tot_eff = 0
                    comp_eff = 0
                    for i in issues:
                        eff = getattr(i, "estimated_effort", 0) or 0
                        tot_eff += eff
                        st = getattr(i, "status", None)
                        st_val = st.value if hasattr(st, "value") else str(st)
                        if st_val in ("RESOLVED", "CLOSED"):
                            comp += 1
                            comp_eff += eff
                    instance.total_issues = tot
                    instance.completed_issues = comp
                    instance.remaining_issues = max(0, tot - comp)
                    instance.total_estimated_effort = tot_eff
                    instance.completed_estimated_effort = comp_eff
                    instance.progress_percentage = round((comp / tot) * 100) if tot > 0 else 0
                    instance.velocity = comp
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Error in SprintRead.model_validate: %s", e)
        return instance



class SprintAnalytics(BaseModel):
    total_issues: int
    completed_issues: int
    remaining_issues: int
    completion_rate: float
    open_issues: int
    in_progress_issues: int
    resolved_issues: int
    closed_issues: int
    total_capacity_hours: int | None
    workload: list[dict]
    burndown_points: list[dict]
    sprint_health: str | None = None
    is_overdue: bool = False
    days_overdue: int = 0
    total_estimated_effort: int = 0
    completed_effort: int = 0
    remaining_effort: int = 0

class SprintOverview(BaseModel):
    total_sprints: int
    active_sprint: SprintRead | None
    completed_sprints: int
    avg_completion_rate: float
    avg_velocity: float
    overdue_sprints: int

