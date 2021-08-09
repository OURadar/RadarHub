#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>
#include <math.h>

#include <RKWebsocket.h>

#include "common.h"

typedef struct _reporter {
    RKWebsocket      *ws;
    char             welcome[256];
    char             message[256];
    float            rate;
    bool             go;
} RKReporter;

// Global variable
RKReporter *R;

const char healthString[][8192] = {
    "\3{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":0}, \"Recorder\":{\"Value\":false,\"Enum\":1}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,475 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"249 Hz\",\"Enum\":0}, \"rayRate\":6.010, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":0}, \"FPGA Temp\":{\"Value\":\"61.5degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.00 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.466 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.223 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.222 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.625 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.237\",\"Enum\":1}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369167\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638233\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"985.7 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x70\", \"Enum\":2}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":0}, \"STALO\":{\"Value\":true, \"Enum\":0}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":0}, \"Sys Heading\":{\"Value\":\"181.00 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":1}, \"Sys Latitude\":{\"Value\":\"35.2369467\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638167\",\"Enum\":0}, \"LocationFromDescriptor\":true, \"Log Time\":1570804516}",
    "\3{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":1}, \"Recorder\":{\"Value\":false,\"Enum\":2}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,476 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"251 Hz\",\"Enum\":0}, \"rayRate\":6.001, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":0}, \"FPGA Temp\":{\"Value\":\"61.4degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.01 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.464 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.225 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.220 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.511 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.881\",\"Enum\":0}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369165\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638230\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"984.3 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x71\", \"Enum\":0}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":0}, \"STALO\":{\"Value\":true, \"Enum\":0}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":1}, \"Sys Heading\":{\"Value\":\"180.00 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369461\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638169\",\"Enum\":0}, \"LocationFromDescriptor\":true, \"Log Time\":1570804517}",
    "\3{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":2}, \"Recorder\":{\"Value\":false,\"Enum\":0}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,475 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"250 Hz\",\"Enum\":0}, \"rayRate\":6.005, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":1}, \"FPGA Temp\":{\"Value\":\"61.4degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.02 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.468 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.224 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.181 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.326 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.881\",\"Enum\":0}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369165\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638230\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"985.0 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x71\", \"Enum\":0}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":0}, \"STALO\":{\"Value\":true, \"Enum\":1}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":0}, \"Sys Heading\":{\"Value\":\"180.50 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369455\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638165\",\"Enum\":0}, \"LocationFromDescriptor\":true, \"Log Time\":1570804518}",
    "\3{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":1}, \"Recorder\":{\"Value\":false,\"Enum\":2}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,476 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"250 Hz\",\"Enum\":0}, \"rayRate\":6.005, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":1}, \"FPGA Temp\":{\"Value\":\"61.4degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.01 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.463 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.222 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.196 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.326 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.881\",\"Enum\":0}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369165\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638230\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"985.0 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x71\", \"Enum\":0}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":1}, \"STALO\":{\"Value\":true, \"Enum\":0}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":0}, \"Sys Heading\":{\"Value\":\"180.75 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369443\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638163\",\"Enum\":0}, \"LocationFromDescriptor\":true, \"Log Time\":1570804519}"
};

const char controlString[8192] = "\2{"
    "\"name\": \"demo\", "
    "\"Controls\": ["
	    "{\"Label\": \"Go\", \"Command\": \"t y\"}, "
	    "{\"Label\": \"Stop\", \"Command\": \"t z\"}, "
        "{\"Label\": \"Try Me 1\", \"Command\": \"t w 1\"}, "
        "{\"Label\": \"Try Me 2\", \"Command\": \"t w 2\"}, "
	    "{\"Label\": \"PRF 1,000 Hz (84 km)\", \"Command\": \"t prf 1000\"}, "
	    "{\"Label\": \"PRF 1,475 Hz (75 km)\", \"Command\": \"t prf 1475\"}, "
	    "{\"Label\": \"PRF 2,000 Hz (65 km)\", \"Command\": \"t prf 2000\"}, "
	    "{\"Label\": \"PRF 3,000 Hz (40 km)\", \"Command\": \"t prf 3003\"}, "
	    "{\"Label\": \"PRF 4,000 Hz (28 km)\", \"Command\": \"t prf 4000\"}, "
	    "{\"Label\": \"PRF 5,000 Hz (17.6 km)\", \"Command\": \"t prf 5000\"}, "
	    "{\"Label\": \"Stop Pedestal\", \"Command\": \"p stop\"}, "
	    "{\"Label\": \"Park\", \"Command\": \"p point 0 90\"}, "
	    "{\"Label\": \"DC PSU On\", \"Command\": \"h pow on\"}, "
	    "{\"Label\": \"DC PSU Off\", \"Command\": \"h pow off\"}, "
	    "{\"Label\": \"Measure Noise\", \"Command\": \"t n\"}, "
	    "{\"Label\": \"Transmit Toggle\", \"Command\": \"t tx\"}, "
	    "{\"Label\": \"10us pulse\", \"Command\": \"t w s10\"}, "
	    "{\"Label\": \"12us LFM\", \"Command\": \"t w q0412\"}, "
	    "{\"Label\": \"20us pulse\", \"Command\": \"t w s20\"}, "
	    "{\"Label\": \"50us pulse\", \"Command\": \"t w s50\"}, "
	    "{\"Label\": \"TFM + OFM\", \"Command\": \"t w ofm\"}, "
	    "{\"Label\": \"OFM\", \"Command\": \"t w ofmd\"}, "
	    "{\"Label\": \"1-tilt EL 2.4 deg @ 18 deg/s\", \"Command\": \"p vol p 2.4 300 18\"}, "
	    "{\"Label\": \"5-tilt VCP @ 45 deg/s\", \"Command\": \"p vol p 2 300 45/p 4 300 45/p 6 300 45/p 8 300 45/p 10 300 45\"}, "
	    "{\"Label\": \"5-tilt VCP @ 25 deg/s\", \"Command\": \"p vol p 2 300 25/p 4 300 25/p 6 300 25/p 8 300 25/p 10 300 25\"}, "
	    "{\"Label\": \"5-tilt VCP @ 18 deg/s\", \"Command\": \"p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18\"}, "
	    "{\"Label\": \"5-tilt VCP @ 12 deg/s\", \"Command\": \"p vol p 2 300 12/p 4 300 12/p 6 300 12/p 8 300 12/p 10 300 12\"}, "
	    "{\"Label\": \"6-tilt VCP @ 18 deg/s\", \"Command\": \"p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18/p 12 300 18\"}"
    "]"
"}";

// Local functions
static void handleSignals(int signal) {
    fprintf(stderr, "\nCaught %d\n", signal);
    RKWebsocketStop(R->ws);
}

static void tukeywin(float *window, const int count, const float alpha) {
    int i;
    int a = count * alpha;
    for (i = a; i < count - a; i++) {
        window[i] = 25000.0f;
    }
    for (i = 0; i < a; i++) {
        float w = 25000.0f * (0.5f - 0.5f * cosf(-(float)i / (float)a * M_PI));
        window[i] = w;
        window[count - 1 - i] = w;
    }
}

// The busy run loop - the reporter
void *run(void *in) {
    int k;
    int j = 0;

    // Let's do 20 FPS
    const useconds_t s = 1000000 / 20;

    // Post health status every 0.5s
    const int ht = 500000 / s;

    // Health depth is just the number of samples we have up there
    const int hdepth = sizeof(healthString) / sizeof(healthString[0]);

    const int count = 1000;
    const int depth = 1 + 2 * count * sizeof(int16_t);
    void *buf = (int16_t *)malloc(30 * depth);
    int16_t *noise = (int16_t *)malloc(3 * count * sizeof(int16_t));
    float *window = (float *)malloc(count * sizeof(float));
    tukeywin(window, count, 0.1);
    int g;
    float w;
    float o;
    float t;
    int16_t *n;
    int16_t *x;
    char *payload;
    int nm = 1000;

    // Some kind of pseudo-noise sequence
    for (k = 0; k < 3 * count; k++) {
        if (rand() % 21 == 0) {
            g = rand() % 32000;
            noise[k] = rand() % g - g / 2;
        } else {
            noise[k] = rand() % (2 * nm) - nm;
        }
    }

    // Wait until handshake is confirmed
    while (!R->ws->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mBusy run loop\033[m\n");

    // Stay busy as long as the websocket is active
    while (R->ws->wantActive) {
        // AScope samples
        payload = (char *)(buf + (j % 30) * depth);
        payload[0] = '\5';
        x = (int16_t *)(payload + 1);
        g = rand() % count;
        n = &noise[g];
        for (k = 0; k < count; k++) {
            if (R->go) {
                t = (float)k / count;
                o = 0.1f * (t + R->rate * 777.0f * t * t - (float)j);
                w = window[k];
                *(x        ) = (int16_t)(w * cosf(o)) + *n;
                *(x + count) = (int16_t)(w * sinf(o)) + *(n++ + count);
            } else {
                *(x        ) = *n;
                *(x + count) = *(n++ + count);
            }
            x++;
        }
        RKWebsocketSend(R->ws, payload, depth);

        if (j % ht == 0) {
            payload = (char *)healthString[(j / ht) % hdepth];
            RKWebsocketSend(R->ws, payload, strlen(payload));
        }

        usleep(s);
        j++;
    }

    free(window);
    free(noise);
    free(buf);

    return NULL;
}

void handleOpen(RKWebsocket *w) {
    int r = sprintf(R->welcome, "\1{\"radar\":\"demo\",\"command\":\"radarConnect\"}");
    RKWebsocketSend(R->ws, R->welcome, r);
    RKWebsocketSend(R->ws, (char *)controlString, strlen(controlString));
}

void handleMessage(RKWebsocket *W, void *payload, size_t size) {
    printf("ONMESSAGE \033[38;5;220m%s\033[m\n", (char *)payload);
    if (strstr((char *)payload, "ello") != NULL) {
        return;
    }
    int r = sprintf(R->message, "\6%s", (char *)payload);
    if (!strcmp(payload, "t y")) {
        R->go = true;
        R->rate = 1.0f;
    } else if (!strcmp(payload, "t z")) {
        R->go = false;
    } else if (!strcmp(payload, "t w 1")) {
        R->rate = -2.5f;
        R->go = true;
    } else if (!strcmp(payload, "t w 2")) {
        R->rate = 5.0f;
        R->go = true;
    }
    printf("REPLY %s (%d)\n", R->message, r);
    RKWebsocketSend(R->ws, R->message, r);
}

int main(int argc, const char *argv[]) {
    R = (RKReporter *)malloc(sizeof(RKReporter));
    memset(R, 0, sizeof(RKReporter));

    if (argc == 1) {
        R->ws = RKWebsocketInit("localhost:8000", "/ws/radar/demo/", RKWebsocketSSLOff);
    } else {
        R->ws = RKWebsocketInit(argv[1], "/ws/radar/demo/", RKWebsocketSSLAuto);
    }
    RKWebsocketSetOpenHandler(R->ws, &handleOpen);
    RKWebsocketSetMessageHandler(R->ws, &handleMessage);
    R->ws->verbose = 1;

    // Catch Ctrl-C and some signals alternative handling
    signal(SIGINT, handleSignals);

    RKWebsocketStart(R->ws);

    RKWebsocketWait(R->ws);

    pthread_t tid;
    pthread_create(&tid, NULL, run, NULL);

    while (R->ws->wantActive) {
        usleep(100000);
    }

    RKWebsocketFree(R->ws);

    free(R);

    exit(EXIT_SUCCESS);
}
