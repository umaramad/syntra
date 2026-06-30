from flask import Flask, jsonify, request

from services.task_group_service import TaskGroupService


def register_task_group_routes(app: Flask) -> None:
    group_service = TaskGroupService()

    @app.route("/api/task-groups/archived", methods=["GET"])
    def list_archived_task_groups():
        groups = group_service.list_archived_groups_with_tasks()
        return jsonify(groups)

    @app.route("/api/task-groups", methods=["GET"])
    def list_task_groups():
        groups = group_service.list_groups()
        return jsonify([group.to_dict() for group in groups])

    @app.route("/api/task-groups", methods=["POST"])
    def create_task_group():
        data = request.get_json(silent=True) or {}
        try:
            group = group_service.create_group(data.get("name", ""))
            return jsonify(group.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/task-groups/<int:group_id>/archive", methods=["POST"])
    def archive_task_group(group_id):
        try:
            group = group_service.archive_group(group_id)
            return jsonify(group.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/task-groups/<int:group_id>/restore", methods=["POST"])
    def restore_task_group(group_id):
        try:
            group = group_service.restore_group(group_id)
            return jsonify(group.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/task-groups/<int:group_id>", methods=["DELETE"])
    def delete_task_group(group_id):
        try:
            if not group_service.delete_archived_group(group_id):
                return jsonify({"error": "Task group not found"}), 404
            return jsonify({"success": True})
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
