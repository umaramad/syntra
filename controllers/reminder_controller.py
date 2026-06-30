from flask import Flask, jsonify, request

from services.reminder_service import ReminderService


def register_reminder_routes(app: Flask) -> None:
    reminder_service = ReminderService()

    @app.route("/api/reminders", methods=["GET"])
    def list_reminders():
        reminders = reminder_service.list_reminders()
        return jsonify([reminder.to_dict() for reminder in reminders])

    @app.route("/api/reminders", methods=["POST"])
    def create_reminder():
        data = request.get_json(silent=True) or {}
        assigned_to = data.get("assigned_to")
        try:
            reminder = reminder_service.create_reminder(
                title=data.get("title", ""),
                remind_at=data.get("remind_at", ""),
                assigned_to=int(assigned_to) if assigned_to not in (None, "") else None,
            )
            return jsonify(reminder.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/reminders/<int:reminder_id>", methods=["PUT"])
    def update_reminder(reminder_id):
        data = request.get_json(silent=True) or {}
        assigned_to = data.get("assigned_to")
        try:
            reminder = reminder_service.update_reminder(
                reminder_id,
                title=data.get("title"),
                remind_at=data.get("remind_at"),
                assigned_to=int(assigned_to) if assigned_to not in (None, "") else None,
                status=data.get("status"),
                update_assignee=True,
            )
            if not reminder:
                return jsonify({"error": "Reminder not found"}), 404
            return jsonify(reminder.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/reminders/<int:reminder_id>", methods=["DELETE"])
    def delete_reminder(reminder_id):
        if not reminder_service.delete_reminder(reminder_id):
            return jsonify({"error": "Reminder not found"}), 404
        return jsonify({"success": True})
