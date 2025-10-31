from flask import Flask, send_from_directory
import os


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(__file__), "static"),
        template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    )

    @app.get("/")
    def hub():
        return send_from_directory(app.template_folder, "hub.html")

    # Alias-Route für direkte Links wie /hub
    @app.get("/hub")
    def hub_alias():
        return send_from_directory(app.template_folder, "hub.html")

    @app.get("/pendel")
    def pendel():
        return send_from_directory(app.template_folder, "index.html")

    @app.get("/logistic")
    def logistic():
        build_dir = os.path.join(app.static_folder, "logistic-app")
        index_path = os.path.join(build_dir, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(build_dir, "index.html")
        return send_from_directory(app.template_folder, "logistic.html")

    @app.get("/flashcards")
    def flashcards():
        return send_from_directory(app.template_folder, "flashcards.html")

    @app.get("/abi")
    def abi():
        return send_from_directory(app.template_folder, "abi.html")

    @app.get("/static/<path:filename>")
    def static_files(filename: str):
        return send_from_directory(app.static_folder, filename)

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False)

