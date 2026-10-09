from flask import Flask, jsonify, request

from services.leave_service import LeaveService


def register_leave_routes(app: Flask) -> None:
    leave_service = LeaveService()

    @app.route("/api/leave-plans", methods=["GET"])
    def list_leave_plans():
        raw_member_id = request.args.get("member_id")
        member_id = None
        if raw_member_id is not None:
            try:
                member_id = int(raw_member_id)
            except (TypeError, ValueError):
                return jsonify({"error": "member_id must be an integer"}), 400
        plans = leave_service.list_plans(member_id)
        return jsonify([plan.to_dict() for plan in plans])

    @app.route("/api/leave-plans", methods=["POST"])
    def create_leave_plan():
        data = request.get_json(silent=True) or {}
        try:
            plan = leave_service.create_plan(
                team_member_id=data.get("team_member_id"),
                start_date=data.get("start_date"),
                end_date=data.get("end_date"),
                details=data.get("details"),
            )
            return jsonify(plan.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/leave-plans/<int:plan_id>", methods=["PUT"])
    def update_leave_plan(plan_id):
        data = request.get_json(silent=True) or {}
        try:
            plan = leave_service.update_plan(plan_id, data)
            if not plan:
                return jsonify({"error": "Leave plan not found"}), 404
            return jsonify(plan.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/leave-plans/<int:plan_id>", methods=["DELETE"])
    def delete_leave_plan(plan_id):
        if not leave_service.delete_plan(plan_id):
            return jsonify({"error": "Leave plan not found"}), 404
        return jsonify({"success": True})
