import logging
import json
import os

from jinja2 import Environment, FileSystemLoader


jinja_env = Environment(loader=FileSystemLoader(os.getenv("TEMPLATE_ROOT", "templates")))

logger = logging.getLogger()

static_root = os.getenv("STATIC_ROOT", "static")


def render_template(template_name, **context):
    template = jinja_env.get_template(template_name)
    return template.render({
            "static_root": static_root,
        } | context)


def lambda_handler(event={}, context={}):
    logger.debug(json.dumps(event))
    path = event.get("requestContext", {}).get("http", {}).get("path")
    print(path)
    if path == "/":
        html = render_template("home.html")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html"},
            "body": html,
        }
    if path == "/about":
        html = render_template("home.html")
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html"},
            "body": html,
        }
    return {"statusCode": 404, "body": "Not Found"}
