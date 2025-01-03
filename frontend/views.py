import logging
import django.http

from django.conf import settings
from django.contrib.auth import get_user
from django.views.decorators.http import require_GET
from django.shortcuts import render

from common import colorize, colored_variables, get_client_ip
from .archives import location

logger = logging.getLogger("frontend")
default_pathway = list(settings.RADARS.keys())[0]

if settings.DEBUG:
    show = (
        f"{colored_variables(settings.CODE_HASH)}\n"
        + f"{colored_variables(settings.CSS_HASH)}\n"
        + f"{colored_variables(settings.VERSION)}\n"
        + f"{colored_variables(settings.BRANCH)}\n"
        + f"{colored_variables(settings.ENTRIES)}\n"
        + f"{colored_variables(default_pathway)}\n"
    )
    logger.debug(show)

#


def make_vars(request, pathway=default_pathway):
    """
    Make the variables for the context dictionary.

    That way, some of the variables are available in the templates.
    """
    user = get_user(request)
    if request.path == "/" or request.path == "/index.html":
        pathways_to_exclude = ["px10k", "demo"]
        radars_to_show = {p: i["name"] for p, i in settings.RADARS.items() if p not in pathways_to_exclude}
    else:
        radars_to_show = []
    output = {
        "pathway": pathway,
        "name": settings.RADARS.get(pathway, {}).get("name", ""),
        "user": user.email if user.is_authenticated else None,
        "ip": get_client_ip(request),
        "version": settings.VERSION,
        "branch": settings.BRANCH,
        "css_hash": settings.CSS_HASH,
        "code_hash": settings.CODE_HASH,
        "origin": location(pathway) if pathway in settings.RADARS else None,
        "radars": radars_to_show,
    }
    return output


#


def index(request):
    """
    Some variables are necessary to repeat
    """
    vars = make_vars(request)
    context = {
        "vars": vars,
        "css": settings.CSS_HASH,
        "code": settings.CODE_HASH,
        "branch": settings.BRANCH,
        "version": settings.VERSION,
    }
    return render(request, "frontend/index.html", context)


# Main
# TODO: Update templates to use new "vars" dictionary


def main(request, entry="archive", pathway=default_pathway, **kwargs):
    myname = colorize("views.main()", "green")
    vars = make_vars(request, pathway)
    if pathway not in settings.RADARS:
        return page404(request, None)
    if entry not in settings.ENTRIES:
        return page404(request, None)
    if kwargs.get("profileGL", False):
        vars["profileGL"] = True
    ip = vars.get("ip", "-")
    user = vars.get("user", "anon")
    logger.info(f"{myname} {colored_variables(entry, pathway, user, ip)}")
    context = {"entry": entry, "vars": vars, "css": settings.CSS_HASH}
    return render(request, f"frontend/single.html", context)


def archive(request, pathway):
    return main(request, "archive", pathway)


def archive_profile(request):
    return main(request, "archive", profileGL=True)


#


@require_GET
def robots_txt(request):
    logger.info(f"robots.txt from {get_client_ip(request)}")
    lines = [
        "User-Agent: *",
        "Disallow: /archive/",
        "Disallow: /control/",
        "Disallow: /data/",
    ]
    content = "\n".join(lines)
    return django.http.HttpResponse(content, content_type="text/plain")


def view(request, page):
    context = {"css": settings.CSS_HASH}
    return render(request, f"{page}.html", context, status=200)


def page400(request, exception):
    if settings.VERBOSE > 1 and exception:
        logger.error(f"404: {exception}")
    context = {"css": settings.CSS_HASH}
    return render(request, f"400.html", context, status=400)


def page403(request, exception):
    if settings.VERBOSE > 1 and exception:
        logger.error(f"404: {exception}")
    context = {"css": settings.CSS_HASH}
    return render(request, f"403.html", context, status=403)


def page404(request, exception):
    if settings.VERBOSE > 1 and exception:
        logger.error(f"404: {exception}")
    context = {"css": settings.CSS_HASH}
    return render(request, f"404.html", context, status=404)
