from awslambda.app import lambda_handler


if __name__ == "__main__":
    from flask import Flask

    app = Flask(__name__)

    # Not sure why this is needed instead of just the catch all below
    @app.route("/")
    def home():
        return lambda_handler({"requestContext": {"http": {"path": f"/"}}})["body"]

    @app.route("/<path:text>")
    def all_routes(text):
        return lambda_handler({"requestContext": {"http": {"path": f"/{text}"}}})["body"]

    if __name__ == "__main__":
        app.run(host="0.0.0.0", port=5000, debug=True)
