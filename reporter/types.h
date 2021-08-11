#ifndef __RadarHub_Types__
#define __RadarHub_Types__

enum RadarHubType {
    RadarHubTypeHandshake       = 1,             // JSON message {"radar":"px1000","command":"radarConnect"}
    RadarHubTypeControl         = 2,             // JSON control {"Go":{...},"Stop":{...},...}
    RadarHubTypeHealth          = 3,             // JSON health {"Transceiver":{...},"Pedestal":{...},...}
    RadarHubTypeReserve4        = 4,             //
    RadarHubTypeScope           = 5,             // Scope data in binary
    RadarHubTypeResponse        = 6,             // Plain text response
    RadarHubTypeReserved7       = 7,             //
    RadarHubTypeReserved8       = 8,             //
    RadarHubTypeReserved9       = 9,             //
    RadarHubTypeReserved10      = 10,            //
    RadarHubTypeReserved11      = 11,            //
    RadarHubTypeReserved12      = 12,            //
    RadarHubTypeReserved13      = 13,            //
    RadarHubTypeReserved14      = 14,            //
    RadarHubTypeReserved15      = 15,            //
    RadarHubTypeRadialZ         = 16,            //
    RadarHubTypeRadialV         = 17,            //
    RadarHubTypeRadialW         = 18,            //
    RadarHubTypeRadialD         = 19,            //
    RadarHubTypeRadialP         = 20,            //
    RadarHubTypeRadialR         = 21             //
};

enum Blah {
    BlahOne,
    BlahTwo,
    BlahThree
};

#endif
