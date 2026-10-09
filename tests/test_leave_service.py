import pytest

from database.db import get_db
from repositories.team_repository import TeamRepository
from services.leave_service import LeaveService
from services.team_service import TeamService


def _create_member(name="Sam", email="sam@example.com"):
    return TeamRepository().create_member({"name": name, "email": email})


def test_create_single_day_leave_with_details(db_path, team_member):
    plan = LeaveService().create_plan(
        team_member_id=team_member.id,
        start_date="2026-10-12",
        end_date="2026-10-12",
        details="  Appointment  ",
    )

    assert plan.team_member_id == team_member.id
    assert plan.member_name == "Alex"
    assert plan.start_date == "2026-10-12"
    assert plan.end_date == "2026-10-12"
    assert plan.details == "Appointment"
    assert plan.created_at


def test_create_multi_day_leave_without_details(db_path, team_member):
    plan = LeaveService().create_plan(
        team_member_id=team_member.id,
        start_date="2026-11-01",
        end_date="2026-11-05",
    )

    assert plan.details is None
    assert plan.end_date == "2026-11-05"


def test_create_rejects_inverted_range(db_path, team_member):
    with pytest.raises(ValueError, match="on or after the start date"):
        LeaveService().create_plan(
            team_member_id=team_member.id,
            start_date="2026-10-12",
            end_date="2026-10-11",
        )


def test_create_rejects_malformed_and_missing_dates(db_path, team_member):
    service = LeaveService()
    with pytest.raises(ValueError, match="YYYY-MM-DD"):
        service.create_plan(team_member.id, "12-10-2026", "2026-10-12")
    with pytest.raises(ValueError, match="not a valid date"):
        service.create_plan(team_member.id, "2026-02-30", "2026-03-01")
    with pytest.raises(ValueError, match="Start date is required"):
        service.create_plan(team_member.id, None, "2026-10-12")
    with pytest.raises(ValueError, match="End date is required"):
        service.create_plan(team_member.id, "2026-10-12", "")


def test_create_rejects_bad_member(db_path):
    service = LeaveService()
    with pytest.raises(ValueError, match="Team member is required"):
        service.create_plan(None, "2026-10-12", "2026-10-12")
    with pytest.raises(ValueError, match="Team member not found"):
        service.create_plan(9999, "2026-10-12", "2026-10-12")


def test_create_rejects_overlong_details(db_path, team_member):
    with pytest.raises(ValueError, match="500 characters or fewer"):
        LeaveService().create_plan(
            team_member.id,
            "2026-10-12",
            "2026-10-12",
            details="x" * 501,
        )


def test_list_sorted_descending_and_member_filter(db_path, team_member):
    other = _create_member()
    service = LeaveService()
    service.create_plan(team_member.id, "2026-10-12", "2026-10-12")
    service.create_plan(team_member.id, "2026-12-01", "2026-12-05")
    service.create_plan(other.id, "2026-11-01", "2026-11-02")

    plans = service.list_plans()
    assert [p.start_date for p in plans] == ["2026-12-01", "2026-11-01", "2026-10-12"]
    assert plans[0].member_name == "Alex"

    only_other = service.list_plans(other.id)
    assert len(only_other) == 1
    assert only_other[0].member_name == "Sam"


def test_update_partial_fields(db_path, team_member):
    service = LeaveService()
    plan = service.create_plan(team_member.id, "2026-10-12", "2026-10-14", "Trip")

    updated = service.update_plan(plan.id, {"end_date": "2026-10-16"})
    assert updated.start_date == "2026-10-12"
    assert updated.end_date == "2026-10-16"
    assert updated.details == "Trip"
    assert updated.updated_at

    updated = service.update_plan(plan.id, {"details": "Extended"})
    assert updated.end_date == "2026-10-16"
    assert updated.details == "Extended"


def test_update_validates_merged_range(db_path, team_member):
    service = LeaveService()
    plan = service.create_plan(team_member.id, "2026-10-12", "2026-10-14")

    with pytest.raises(ValueError, match="on or after the start date"):
        service.update_plan(plan.id, {"end_date": "2026-10-10"})


def test_update_unknown_id_returns_none(db_path):
    assert LeaveService().update_plan(9999, {"details": "x"}) is None


def test_delete_plan_flow(db_path, team_member):
    service = LeaveService()
    plan = service.create_plan(team_member.id, "2026-10-12", "2026-10-12")

    assert service.delete_plan(plan.id) is True
    assert service.repository.find_by_id(plan.id) is None
    assert service.delete_plan(plan.id) is False


def test_overlapping_plans_allowed(db_path, team_member):
    service = LeaveService()
    first = service.create_plan(team_member.id, "2026-10-10", "2026-10-20", "Trip")
    second = service.create_plan(team_member.id, "2026-10-15", "2026-10-16", "Follow-up")

    assert service.repository.find_by_id(first.id) is not None
    assert service.repository.find_by_id(second.id) is not None
    assert len(service.list_plans(team_member.id)) == 2


def test_deleting_member_cascades_their_leave_plans(db_path, team_member):
    service = LeaveService()
    service.create_plan(team_member.id, "2026-10-12", "2026-10-14")
    service.create_plan(team_member.id, "2026-12-01", "2026-12-05")

    assert TeamService().delete_member(team_member.id) is True

    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS total FROM leave_plans"
        ).fetchone()
        assert row["total"] == 0


def test_route_create_and_get(db_path, team_member):
    from app import create_app

    client = create_app().test_client()

    response = client.post(
        "/api/leave-plans",
        json={
            "team_member_id": team_member.id,
            "start_date": "2026-10-12",
            "end_date": "2026-10-14",
            "details": "Vacation",
        },
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["member_name"] == "Alex"
    assert body["start_date"] == "2026-10-12"

    response = client.get("/api/leave-plans")
    assert response.status_code == 200
    assert len(response.get_json()) == 1

    response = client.get(f"/api/leave-plans?member_id={team_member.id}")
    assert response.status_code == 200
    assert len(response.get_json()) == 1

    response = client.get("/api/leave-plans?member_id=9999")
    assert response.status_code == 200
    assert response.get_json() == []

    response = client.get("/api/leave-plans?member_id=abc")
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_route_validation_returns_400(db_path, team_member):
    from app import create_app

    client = create_app().test_client()

    response = client.post(
        "/api/leave-plans",
        json={
            "team_member_id": team_member.id,
            "start_date": "2026-10-14",
            "end_date": "2026-10-12",
        },
    )
    assert response.status_code == 400
    assert "error" in response.get_json()

    response = client.post(
        "/api/leave-plans",
        json={"start_date": "2026-10-12", "end_date": "2026-10-14"},
    )
    assert response.status_code == 400


def test_route_put_and_delete_404s(db_path, team_member):
    from app import create_app

    client = create_app().test_client()

    response = client.put("/api/leave-plans/9999", json={"details": "x"})
    assert response.status_code == 404

    response = client.delete("/api/leave-plans/9999")
    assert response.status_code == 404
    assert response.get_json()["error"] == "Leave plan not found"

    created = client.post(
        "/api/leave-plans",
        json={
            "team_member_id": team_member.id,
            "start_date": "2026-10-12",
            "end_date": "2026-10-12",
        },
    ).get_json()

    response = client.put(
        f"/api/leave-plans/{created['id']}", json={"end_date": "2026-10-13"}
    )
    assert response.status_code == 200
    assert response.get_json()["end_date"] == "2026-10-13"

    response = client.delete(f"/api/leave-plans/{created['id']}")
    assert response.status_code == 200
    assert response.get_json() == {"success": True}
