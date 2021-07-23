# RadarHub

This is a [Django]-[Channels] for web interface to the radar operations.

Three main parts:

- [Django] backend
- [React] frontend
- Backhaul for general radar communication

## Milestones

- v0.1 - Can run
- v0.2 - Scope + Health working
- v0.3 - Some button actions to backhaul
- v0.4 - Get an external websocket client
- v0.5 - PPI / 3D view
- v0.6 - SQLite / product browser
- v0.7 - General page template + stylesheets
- v0.8 - Authentication
- v0.9 - Landing page
- v1.0 - RadarKit communicates with RadarHub

[django]: https://www.djangoproject.com
[channels]: https://channels.readthedocs.io/en/stable/
[react]: https://reactjs.org

## Help Me Remember

To restart the app on the production server:

```
supervisorctl restart all
```
