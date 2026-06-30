from flask import Flask, jsonify, request

from services.user_profile_service import UserProfileService


def register_profile_routes(app: Flask) -> None:
    profile_service = UserProfileService()

    @app.route("/api/profile", methods=["GET"])
    def get_profile():
        return jsonify(profile_service.get_profile().to_dict())

    @app.route("/api/profile", methods=["PUT"])
    def update_profile():
        data = request.get_json(silent=True) or {}
        team_member_id = data.get("team_member_id")
        try:
            profile = profile_service.update_profile(
                display_name=data.get("display_name", ""),
                email=data.get("email"),
                role=data.get("role"),
                team_member_id=int(team_member_id) if team_member_id not in (None, "") else None,
                update_team_link="team_member_id" in data,
            )
            return jsonify(profile.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
