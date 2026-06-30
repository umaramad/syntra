from flask import Flask, jsonify, request

from services.mcp_executor_service import MCPExecutorService


def register_mcp_routes(app: Flask) -> None:
    mcp_service = MCPExecutorService()

    @app.route("/api/mcp/tools", methods=["GET"])
    def list_tools():
        return jsonify(mcp_service.list_tools())

    @app.route("/api/mcp/execute", methods=["POST"])
    def execute():
        data = request.get_json(silent=True) or {}
        result = mcp_service.handle_execute(data)
        status = 200 if result.get("success") else 400
        return jsonify(result), status
