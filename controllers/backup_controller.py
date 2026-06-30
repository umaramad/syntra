import json
from datetime import datetime

from flask import Flask, Response, jsonify, request

from services.backup_service import BackupService


def register_backup_routes(app: Flask) -> None:
    backup_service = BackupService()

    @app.route("/api/backup", methods=["GET"])
    def export_backup():
        backup = backup_service.export_backup()

        if request.args.get("download"):
            timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
            filename = f"syntra-backup-{timestamp}.json"
            payload = json.dumps(backup, indent=2, ensure_ascii=False)
            return Response(
                payload,
                mimetype="application/json",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                },
            )

        return jsonify(backup)

    @app.route("/api/backup/import", methods=["POST"])
    def import_backup():
        payload = request.get_json(silent=True)
        if payload is None:
            return jsonify({"error": "Invalid backup JSON"}), 400

        try:
            result = backup_service.import_backup(payload)
            return jsonify(result)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
