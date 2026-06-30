from flask import Flask, jsonify, request

from services.team_service import TeamService


def register_team_routes(app: Flask) -> None:
    team_service = TeamService()

    @app.route("/api/team", methods=["GET"])
    def list_members():
        members = team_service.list_members()
        return jsonify([member.to_dict() for member in members])

    @app.route("/api/team", methods=["POST"])
    def create_member():
        data = request.get_json(silent=True) or {}
        try:
            member = team_service.create_member(
                name=data.get("name", ""),
                role=data.get("role"),
                email=data.get("email"),
            )
            return jsonify(member.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/team/<int:member_id>", methods=["PUT"])
    def update_member(member_id):
        data = request.get_json(silent=True) or {}
        try:
            member = team_service.update_member(
                member_id,
                name=data.get("name"),
                role=data.get("role"),
                email=data.get("email"),
                status=data.get("status"),
            )
            if not member:
                return jsonify({"error": "Member not found"}), 404
            return jsonify(member.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/team/<int:member_id>", methods=["DELETE"])
    def delete_member(member_id):
        if not team_service.delete_member(member_id):
            return jsonify({"error": "Member not found"}), 404
        return jsonify({"success": True})
