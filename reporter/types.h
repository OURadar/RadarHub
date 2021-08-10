#ifndef __RadarHub_Types__
#define __RadarHub_Types__

enum RadarHubType {
    RadarHubTypeHandshake       = 1,             // JSON message {"radar":"px1000","command":"radarConnect"}
    RadarHubTypeControl         = 2,             // JSON control {"Go":{...},"Stop":{...},...}
    RadarHubTypeHealth          = 3,             // JSON health {"Transceiver":{...},"Pedestal":{...},...}
    RadarHubTypeRay             = 4,             //
    RadarHubTypeScope           = 5,             // Scope data in binary
    RadarHubTypeCommandResponse = 6              // Plain text response
};

#endif
