# RadarHub

This is a [Django]-[Channels] for web interface to the radar operations.

Three main parts:

- [Django] backend
- [React] frontend
- Backhaul for general radar communication

## Milestones

0.1 - Can run
0.2 - Scope + Health working
0.3 - Some button actions to backhaul
0.4 - Get an external websocket client
0.5 - PPI / 3D view
0.6 - SQLite / product browser
0.7 - General page template + stylesheets
0.8 - Authentication
0.9 - Landing page
1.0 - RadarKit communicates with RadarHub

[django]: https://www.djangoproject.com
[channels]: https://channels.readthedocs.io/en/stable/
[react]: https://reactjs.org

## Help Me Remember

To restart the app on the production server:

```
supervisorctl restart all
```
