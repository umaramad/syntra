from functools import wraps

from flask import Flask, Response, jsonify, redirect, render_template, request, session

from services.git_compare_auth_service import GitCompareAuthService
from services.git_compare_html_service import comparison_from_history, render_comparison_html
from services.git_compare_service import GitCompareService
from services.git_providers.http_client import GitApiError


def register_git_compare_routes(app: Flask) -> None:
    auth_service = GitCompareAuthService()
    compare_service = GitCompareService(auth_service=auth_service)

    def require_auth_json(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get(GitCompareAuthService.SESSION_USER):
                return jsonify({"error": "Not authenticated"}), 401
            return view(*args, **kwargs)

        return wrapped

    def require_auth_page(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get(GitCompareAuthService.SESSION_USER):
                return redirect("/git-compare/login")
            return view(*args, **kwargs)

        return wrapped

    @app.route("/git-compare/")
    def git_compare_index():
        if session.get(GitCompareAuthService.SESSION_USER):
            return redirect("/git-compare/app")
        return redirect("/git-compare/login")

    @app.route("/git-compare/login", methods=["GET"])
    def git_compare_login_page():
        if session.get(GitCompareAuthService.SESSION_USER):
            return redirect("/git-compare/app")
        return render_template("git_compare/login.html")

    @app.route("/git-compare/app", methods=["GET"])
    @require_auth_page
    def git_compare_app_page():
        return render_template("git_compare/app.html")

    @app.route("/git-compare/view/<int:entry_id>", methods=["GET"])
    @require_auth_page
    def git_compare_view_page(entry_id: int):
        return render_template("git_compare/view.html", entry_id=entry_id)

    @app.route("/git-compare/api/login", methods=["POST"])
    def git_compare_login():
        data = request.get_json(silent=True) or {}
        try:
            result = auth_service.login(
                user_id=data.get("user_id", ""),
                provider=data.get("provider", "github"),
                auth_type=data.get("auth_type", "pat"),
                token=data.get("token", ""),
                password=data.get("password", ""),
            )
            return jsonify({"success": True, "user": result})
        except ValueError as exc:
            return jsonify({"success": False, "error": str(exc)}), 400

    @app.route("/git-compare/api/logout", methods=["POST"])
    def git_compare_logout():
        auth_service.logout()
        return jsonify({"success": True})

    @app.route("/git-compare/api/session", methods=["GET"])
    def git_compare_session():
        user = auth_service.current_user()
        if not user:
            return jsonify({"authenticated": False}), 401
        return jsonify({"authenticated": True, "user": user})

    @app.route("/git-compare/api/refs", methods=["GET"])
    @require_auth_json
    def git_compare_refs():
        repo = request.args.get("repo", "")
        try:
            return jsonify(compare_service.list_refs(repo))
        except (ValueError, GitApiError) as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/git-compare/api/compare", methods=["POST"])
    @require_auth_json
    def git_compare_run():
        data = request.get_json(silent=True) or {}
        try:
            result = compare_service.compare(
                from_repo_value=data.get("from_repo", ""),
                to_repo_value=data.get("to_repo", ""),
                from_ref=data.get("from_ref", ""),
                from_ref_type=data.get("from_ref_type", "branch"),
                to_ref=data.get("to_ref", ""),
                to_ref_type=data.get("to_ref_type", "branch"),
            )
            return jsonify(result)
        except PermissionError as exc:
            return jsonify({"error": str(exc)}), 401
        except (ValueError, GitApiError) as exc:
            return jsonify({"error": str(exc)}), 400

    @app.route("/git-compare/api/history", methods=["GET"])
    @require_auth_json
    def git_compare_history():
        try:
            return jsonify(compare_service.list_history())
        except PermissionError as exc:
            return jsonify({"error": str(exc)}), 401

    @app.route("/git-compare/api/history/<int:entry_id>", methods=["GET"])
    @require_auth_json
    def git_compare_history_detail(entry_id: int):
        try:
            include_files = request.args.get("include_files", "1") != "0"
            return jsonify(compare_service.get_history(entry_id, include_files=include_files))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 404
        except PermissionError as exc:
            return jsonify({"error": str(exc)}), 401

    @app.route("/git-compare/api/history/<int:entry_id>/download", methods=["GET"])
    @require_auth_json
    def git_compare_history_download(entry_id: int):
        try:
            entry = compare_service.get_history(entry_id, include_files=True)
            comparison = comparison_from_history(entry)
            html_doc = render_comparison_html(
                comparison,
                title=f"Git Compare — {entry['from_repo']} vs {entry['to_repo']}",
            )
            filename = f"git-compare-{entry_id}.html"
            return Response(
                html_doc,
                mimetype="text/html",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 404
        except PermissionError as exc:
            return jsonify({"error": str(exc)}), 401
