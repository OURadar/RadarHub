import os
import json
import logging

from django.contrib.auth import get_user
from django.http import HttpResponse, JsonResponse
from django.db.utils import ConnectionHandler
from django.utils.connection import ConnectionProxy
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django_eventstream import send_event

from common import colorize, color_name_value, get_client_ip

logger = logging.getLogger("frontend")

# Stats


def profile(request):
    show = colorize("stats.profile()", "green")
    show += "   " + color_name_value("request", request)
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    data = {
        "ip": get_client_ip(request),
        "user": email or "None",
        "emoji": ":sun:" if email else ":sun_behind_small_cloud:",
        "message": "There is no message at this moment",
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type="application/json")
    response["Cache-Control"] = "max-age=60"
    return response


def pretty_size(size):
    if size > 1024 * 1024 * 1024:
        return f"{size/1024/1024/1024:,.2f} GB"
    elif size > 1024 * 1024:
        return f"{size/1024/1024:,.2f} MB"
    elif size > 1024:
        return f"{size/1024:,.2f} KB"
    return f"{size} B"


def check_postgres_size(connection):
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_database_size(current_database())")
        size = cursor.fetchone()[0]
        return pretty_size(size)


def check_sqlite_size(connection):
    path = connection.settings_dict["NAME"]
    size = os.path.getsize(path)
    return pretty_size(size)


def list_postgres_tables(connection):
    with connection.cursor() as cursor:
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
        tables = [row[0] for row in cursor.fetchall()]
        print(tables)
        summary = {}
        for table in tables:
            cursor.execute(f"SELECT pg_total_relation_size('{table}');")
            size = cursor.fetchone()[0]
            summary[table] = pretty_size(size)
        return summary


def list_sqlite_tables(connection):
    with connection.cursor() as cursor:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        summary = {}
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            rows = cursor.fetchone()[0]
            summary[table] = f"{rows} rows"
        return summary


def size(request):
    connections = ConnectionHandler()
    summary = {}
    for kind in ["data", "default"]:
        connection = ConnectionProxy(connections, kind)
        engine = connection.settings_dict["ENGINE"]
        if "sqlite" in engine:
            size = check_sqlite_size(connection)
            tables = list_sqlite_tables(connection)
        elif "postgres" in engine:
            size = check_postgres_size(connection)
            tables = list_postgres_tables(connection)
        else:
            size = "Unknown"
        show = colorize("stats.size()", "green")
        show += "   " + color_name_value("kind", kind)
        show += "   " + color_name_value("engine", engine)
        show += "   " + color_name_value("size", size)
        print(show)
        summary[kind] = {"total": size, **tables}

    payload = json.dumps(summary)
    response = HttpResponse(payload, content_type="application/json")
    response["Cache-Control"] = "max-age=60"
    return response


@csrf_exempt
@require_POST
def relay(request):
    myname = colorize("stats.relay()", "green")
    headers = dict(request.headers)
    # print(f"{myname} {color_name_value('headers', headers)}")
    if "localhost" not in headers.get("Host"):
        return JsonResponse({"status": "error", "message": "Not allowed"}, status=403)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)
    pathway = data.get("pathway", "unknown")
    items = data.get("items", [])
    logger.info(f"{myname} {color_name_value('items', items)}   {color_name_value('pathway', pathway)}")
    data.pop("pathway")
    send_event("sse", pathway, data)
    return JsonResponse({"status": "ok"})
