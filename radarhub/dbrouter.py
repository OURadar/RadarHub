class DbRouter(object):
    def db_for_read(self, model, **hints):
        # print(f'db_for_read() {model._meta.app_label}')
        if model._meta.db_table in ['frontend_file', 'frontend_day']:
            return 'data'
        return None

    def db_for_write(self, model, **hints):
        # print(f'db_for_write() {model._meta.app_label}')
        if model._meta.db_table in ['frontend_file', 'frontend_day']:
            return 'data'
        return None

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return True
