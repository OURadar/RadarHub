class DbRouter(object):
    def db_for_read(self, model, **hints):
        # print(f"db_for_read() {model._meta.app_label}")
        if model._meta.app_label == "frontend" and model._meta.model_name in ["file", "day", "sweep"]:
            return "data"
        return "default"

    def db_for_write(self, model, **hints):
        # print(f"db_for_write() {model._meta.app_label} / {model._meta.model_name}")
        if model._meta.app_label == "frontend" and model._meta.model_name in ["file", "day", "sweep"]:
            return "data"
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        # print(f"allow_relation()   obj1 = {obj1}   obj2 = {obj2}")
        if (obj1._meta.app_label == "frontend" and obj1._meta.model_name in ["file", "day", "sweep"]) or (
            obj2._meta.app_label == "frontend" and obj2._meta.model_name in ["file", "day", "sweep"]
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        # if app_label == "frontend":
        #     print(f"allow_migrate()   db = {db}   app_label = {app_label}   model_name = {model_name}")
        if app_label == "frontend" and model_name in ["file", "day", "sweep"]:
            return db == "data"
        return db == "default"
