from flask import Flask, jsonify, request

from services.note_service import NoteService


def register_note_routes(app: Flask) -> None:
    note_service = NoteService()

    @app.route("/api/notes", methods=["GET"])
    def list_notes():
        notes = note_service.list_notes()
        return jsonify([note.to_dict() for note in notes])

    @app.route("/api/notes", methods=["POST"])
    def create_note():
        data = request.get_json(silent=True) or {}
        try:
            note = note_service.create_note(
                title=data.get("title", ""),
                content=data.get("content"),
            )
            return jsonify(note.to_dict()), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/notes/<int:note_id>", methods=["PUT"])
    def update_note(note_id):
        data = request.get_json(silent=True) or {}
        try:
            note = note_service.update_note(
                note_id,
                title=data.get("title"),
                content=data.get("content"),
            )
            if not note:
                return jsonify({"error": "Note not found"}), 404
            return jsonify(note.to_dict())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/api/notes/<int:note_id>", methods=["DELETE"])
    def delete_note(note_id):
        if not note_service.delete_note(note_id):
            return jsonify({"error": "Note not found"}), 404
        return jsonify({"success": True})
