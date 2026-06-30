from flask import Flask, render_template

import config
from controllers.mcp_controller import register_mcp_routes
from controllers.note_controller import register_note_routes
from controllers.profile_controller import register_profile_routes
from controllers.reminder_controller import register_reminder_routes
from controllers.task_controller import register_task_routes
from controllers.task_group_controller import register_task_group_routes
from controllers.team_controller import register_team_routes
from database.db import init_db, seed_default_tools


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["DEBUG"] = config.DEBUG

    init_db()
    seed_default_tools()

    register_task_routes(app)
    register_task_group_routes(app)
    register_note_routes(app)
    register_team_routes(app)
    register_profile_routes(app)
    register_reminder_routes(app)
    register_mcp_routes(app)

    @app.route("/")
    def index():
        return render_template("index.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=config.DEBUG)
