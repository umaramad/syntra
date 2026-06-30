from flask import Flask, jsonify, request

from services.task_comment_service import TaskCommentService
from services.task_service import TaskService


def register_task_routes(app: Flask) -> None:
    task_service = TaskService()
    comment_service = TaskCommentService()

    @app.route("/api/tasks", methods=["GET"])
    def list_tasks():
        tasks = task_service.list_tasks(status=request.args.get("status"))
        return jsonify([task.to_dict() for task in tasks])

    @app.route("/api/tasks", methods=["POST"])
    def create_task():
        data = request.get_json(silent=True) or {}
        assigned_to = data.get("assigned_to")
        try:
            task = task_service.create_task(
                title=data.get("title", ""),
                description=data.get("description"),
                priority=data.get("priority", "medium"),
                due_date=data.get("due_date"),
                group_id=data.get("group_id"),
                group_name=data.get("group_name"),
                assigned_to=int(assigned_to) if assigned_to not in (None, "") else None,
            )
            return jsonify(task.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/tasks/<int:task_id>/done", methods=["POST"])
    def mark_task_done(task_id):
        task = task_service.mark_done(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(task.to_dict())

    @app.route("/api/tasks/<int:task_id>", methods=["PUT"])
    def update_task(task_id):
        data = request.get_json(silent=True) or {}
        assigned_to = data.get("assigned_to")
        try:
            task = task_service.update_task(
                task_id,
                title=data.get("title"),
                description=data.get("description"),
                status=data.get("status"),
                priority=data.get("priority"),
                due_date=data.get("due_date"),
                group_id=data.get("group_id"),
                group_name=data.get("group_name"),
                assigned_to=int(assigned_to) if assigned_to not in (None, "") else None,
                update_assignee="assigned_to" in data,
            )
            if not task:
                return jsonify({"error": "Task not found"}), 404
            return jsonify(task.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
    def delete_task(task_id):
        if not task_service.delete_task(task_id):
            return jsonify({"error": "Task not found"}), 404
        return jsonify({"success": True})

    @app.route("/api/tasks/<int:task_id>/comments", methods=["GET"])
    def list_task_comments(task_id):
        comments = comment_service.list_comments(task_id)
        if comments is None:
            return jsonify({"error": "Task not found"}), 404
        return jsonify([comment.to_dict() for comment in comments])

    @app.route("/api/tasks/<int:task_id>/comments", methods=["POST"])
    def add_task_comment(task_id):
        data = request.get_json(silent=True) or {}
        try:
            comment = comment_service.add_comment(
                task_id,
                comment=data.get("comment", ""),
                author_name=data.get("author_name", "User"),
            )
            if not comment:
                return jsonify({"error": "Task not found"}), 404
            return jsonify(comment.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/tasks/<int:task_id>/comments/<int:comment_id>", methods=["DELETE"])
    def delete_task_comment(task_id, comment_id):
        if not comment_service.delete_comment(task_id, comment_id):
            return jsonify({"error": "Comment not found"}), 404
        return jsonify({"success": True})
