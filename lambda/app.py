import logging
import json
import sys

from jinja2 import Environment, FileSystemLoader


env = Environment(loader=FileSystemLoader("templates"))

logger = logging.getLogger()

static_root = "https://static.wallabyfest.co.uk"


def render_template(template_name, **context):
    template = env.get_template(template_name)
    return template.render({
            "static_root": static_root,
        } | context)


def lambda_handler(event={}, context={}):
    logger.debug(json.dumps(event))
    path = event.get("requestContext", {}).get("http", {}).get("path")
    if path == "/":
        html = render_template("home.html")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html"},
            "body": html,
        }
    if path == "/about":
        html = render_template("about.html")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html"},
            "body": html,
        }
    return {"statusCode": 404, "body": "Not Found"}


if __name__ == "__main__":
    # Usage: python app.py [path]
    path = sys.argv[1] if len(sys.argv) > 1 else "/"

    print(lambda_handler({"requestContext": {"http": {"path": path}}})["body"])
