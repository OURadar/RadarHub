import logging

from django.shortcuts import render
from django.http import Http404, HttpResponse
from django.conf import settings
from django.views.decorators.http import require_GET
from django.contrib.auth import get_user

from common import colorize, color_name_value, get_client_ip
from .archives import location

logger = logging.getLogger("frontend")

pathways = [x["pathway"].lower() for x in settings.RADARS.values()]
radar_names = dict([(x["pathway"].lower(), x["name"]) for x in settings.RADARS.values()])
default_pathway = pathways[0]

if settings.DEBUG:
    show = (
        color_name_value("settings.CODE_HASH", settings.CODE_HASH)
        + "\n"
        + color_name_value("settings.CSS_HASH", settings.CSS_HASH)
        + "\n"
        + color_name_value("settings.VERSION", settings.VERSION)
        + "\n"
        + color_name_value("settings.BRANCH", settings.BRANCH)
    )
    logger.debug(show)

#


def make_vars(request, pathway=default_pathway):
    if pathway not in radar_names:
        logger.warning(f"Pathway {pathway} not in radar_names. Not registered.")
        raise Http404
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    origin = location(pathway)
    output = {
        "ip": get_client_ip(request),
        "user": email,
        "css_hash": settings.CSS_HASH,
        "code_hash": settings.CODE_HASH,
        "version": settings.VERSION,
        "branch": settings.BRANCH,
        "origin": origin,
        "pathway": pathway,
        "name": radar_names[pathway],
    }
    if request.path == "/" or request.path == "/index.html":
        pathways_to_exclude = ["px10k"]
        radars_to_show = {p: n for p, n in radar_names.items() if p not in pathways_to_exclude}
        output["radars"] = radars_to_show
    return output


#


def index(request):
    vars = make_vars(request)
    context = {
        "vars": vars,
        "css": settings.CSS_HASH,
        "code": settings.CODE_HASH,
        "branch": settings.BRANCH,
        "version": settings.VERSION,
    }
    return render(request, "frontend/index.html", context)


def develop(request, pathway):
    vars = make_vars(request, pathway)
    context = {
        "vars": vars,
        "css": settings.CSS_HASH,
        "code": settings.CODE_HASH,
        "branch": settings.BRANCH,
        "version": settings.VERSION,
    }
    return render(request, "frontend/develop.html", context)


# Control


def control(request, pathway):
    vars = make_vars(request, pathway)
    show = colorize("views.control()", "green")
    show += "   " + color_name_value("pathway", pathway)
    show += "   " + color_name_value("ip", vars["ip"])
    show += "   " + color_name_value("user", vars["user"])
    logger.info(show)
    context = {"vars": vars, "css": settings.CSS_HASH}
    return render(request, "frontend/control.html", context)


# Archive


def _archive(request, pathway, profileGL=False):
    vars = make_vars(request, pathway)
    show = colorize("views.archive()", "green")
    show += "   " + color_name_value("pathway", pathway)
    show += "   " + color_name_value("ip", vars["ip"])
    show += "   " + color_name_value("user", vars["user"])
    if settings.DEBUG and settings.VERBOSE:
        show += "   " + color_name_value("profileGL", profileGL)
    logger.info(show)
    if pathway not in pathways:
        raise Http404
    if profileGL:
        vars["profileGL"] = True
    context = {"vars": vars, "css": settings.CSS_HASH}
    return render(request, "frontend/archive.html", context)


def archive(request, pathway):
    return _archive(request, pathway, False)


def archive_profile(request):
    return _archive(request, default_pathway, True)


#


@require_GET
def robots_txt(request):
    lines = [
        "User-Agent: *",
        "Disallow: /archive/",
        "Disallow: /control/",
        "Disallow: /data/",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")


def view(request, page):
    context = {"css": settings.CSS_HASH}
    return render(request, f"{page}.html", context, status=200)


def page400(request, exception):
    context = {"css": settings.CSS_HASH}
    return render(request, f"400.html", context, status=400)


def page403(request, exception):
    context = {"css": settings.CSS_HASH}
    return render(request, f"403.html", context, status=403)


def page404(request, exception):
    context = {"css": settings.CSS_HASH}
    return render(request, f"404.html", context, status=404)
