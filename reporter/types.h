#ifndef __RadarHub_Types__
#define __RadarHub_Types__

enum RadarHubType {
    RadarHubTypeHandshake       = 1,             // JSON message {"radar":"px1000","command":"radarConnect"}
    RadarHubTypeControl         = 2,             // JSON control {"Go":{...},"Stop":{...},...}
    RadarHubTypeHealth          = 3,             // JSON health {"Transceiver":{...},"Pedestal":{...},...}
    RadarHubTypeReserve4        = 4,             //
    RadarHubTypeScope           = 5,             // Scope data in binary
    RadarHubTypeCommandResponse = 6,             // Plain text response
    RadarHubTypeReserve7        = 7,             //
    RadarHubTypeReserve8        = 8,             //
    RadarHubTypeReserve9        = 9,             //
    RadarHubTypeReserve10       = 10,            //
    RadarHubTypeReserve11       = 11,            //
    RadarHubTypeReserve12       = 12,            //
    RadarHubTypeReserve13       = 13,            //
    RadarHubTypeReserve14       = 14,            //
    RadarHubTypeReserve15       = 15,            //
    RadarHubTypeRadialZ         = 16,            //
    RadarHubTypeRadialV         = 17,            //
    RadarHubTypeRadialW         = 18,            //
    RadarHubTypeRadialD         = 19,            //
    RadarHubTypeRadialP         = 20,            //
    RadarHubTypeRadialR         = 21,            //
};

#endif
