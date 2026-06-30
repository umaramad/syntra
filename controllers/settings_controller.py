from flask import Flask, jsonify, request

from services.user_settings_service import UserSettingsService


def register_settings_routes(app: Flask) -> None:
    settings_service = UserSettingsService()

    @app.route("/api/settings", methods=["GET"])
    def get_settings():
        return jsonify(settings_service.get_settings().to_dict())

    @app.route("/api/settings", methods=["PUT"])
    def update_settings():
        data = request.get_json(silent=True) or {}
        try:
            reminder_notifications_enabled = None
            if "reminder_notifications_enabled" in data:
                reminder_notifications_enabled = bool(data["reminder_notifications_enabled"])

            reminder_sound_enabled = None
            if "reminder_sound_enabled" in data:
                reminder_sound_enabled = bool(data["reminder_sound_enabled"])

            theme = data.get("theme") if "theme" in data else None

            settings = settings_service.update_settings(
                reminder_notifications_enabled=reminder_notifications_enabled,
                reminder_sound_enabled=reminder_sound_enabled,
                theme=theme,
            )
            return jsonify(settings.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
