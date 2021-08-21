//
//  dgen.c
//  Data Generator in C
//
//  RadarHub
//
//  An example client that establishes a (secure) websocket connection to
//  RadarHub, sends in control interface, scope and health data.
//
//  Created by Boonleng Cheong on 8/3/2021.
//  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
//

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>
#include <math.h>
#include <sys/time.h>
#include <getopt.h>

#include "types.h"
#include "common.h"
#include "RKWebSocket.h"

#define HEALH_CAPACITY  4096

#ifndef VERSION
#define VERSION "0.1"
#endif

typedef struct _reporter {
    RKWebSocket        *ws;
    RKWebSocketSSLFlag flag;
    char               name[64];
    char               host[128];
    char               address[128];
    char               welcome[256];
    char               control[2048];
    char               message[256];
    bool               wantActive;
    bool               connected;
    int                verbose;
    float              rate;
    bool               go;
} RKReporter;

// Global variable
RKReporter *R;

const char healthString[][2400] = {
    "{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":0}, \"Recorder\":{\"Value\":false,\"Enum\":1}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,475 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"249 Hz\",\"Enum\":0}, \"rayRate\":6.010, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":0}, \"FPGA Temp\":{\"Value\":\"61.5degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.00 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.466 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.223 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.222 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.625 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.237\",\"Enum\":1}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369167\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638233\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"985.7 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x70\", \"Enum\":2}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":1}, \"RF VSWR V\":{\"Value\":true, \"Enum\":0}, \"STALO\":{\"Value\":true, \"Enum\":0}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":0}, \"Sys Heading\":{\"Value\":\"181.00 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369467\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638167\",\"Enum\":0}, \"Log Time\":1570804516}",
    "{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":1}, \"Recorder\":{\"Value\":false,\"Enum\":2}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,476 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"251 Hz\",\"Enum\":0}, \"rayRate\":6.001, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":0}, \"FPGA Temp\":{\"Value\":\"61.4degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.01 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.464 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.225 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.220 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.511 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.881\",\"Enum\":0}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369165\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638230\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"984.3 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x71\", \"Enum\":0}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":0}, \"STALO\":{\"Value\":true, \"Enum\":0}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":1}, \"Sys Heading\":{\"Value\":\"180.00 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369467\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638167\",\"Enum\":0}, \"Log Time\":1570804517}",
    "{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":2}, \"Recorder\":{\"Value\":false,\"Enum\":0}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,475 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"250 Hz\",\"Enum\":0}, \"rayRate\":6.005, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":1}, \"FPGA Temp\":{\"Value\":\"61.4degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.02 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.468 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.224 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.181 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.326 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.881\",\"Enum\":0}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369165\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638230\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"985.0 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x71\", \"Enum\":0}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":0}, \"STALO\":{\"Value\":true, \"Enum\":1}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":0}, \"Sys Heading\":{\"Value\":\"180.50 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369467\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638167\",\"Enum\":0}, \"Log Time\":1570804518}",
    "{\"Transceiver\":{\"Value\":true,\"Enum\":0}, \"Pedestal\":{\"Value\":true,\"Enum\":0}, \"Health Relay\":{\"Value\":false,\"Enum\":2}, \"Internet\":{\"Value\":true,\"Enum\":1}, \"Recorder\":{\"Value\":false,\"Enum\":2}, \"Ring Filter\":{\"Value\":false,\"Enum\":1}, \"Processors\":{\"Value\":true,\"Enum\":0}, \"Measured PRF\":{\"Value\":\"1,476 Hz\",\"Enum\":0}, \"Noise\":[50.274,33.654], \"Position Rate\":{\"Value\":\"250 Hz\",\"Enum\":0}, \"rayRate\":6.005, \"10-MHz Clock\":{\"Value\":true,\"Enum\":0}, \"DAC PLL\":{\"Value\":true,\"Enum\":1}, \"FPGA Temp\":{\"Value\":\"61.4degC\",\"Enum\":0}, \"Core Volt\":{\"Value\":\"1.01 V\",\"Enum\":0}, \"Aux. Volt\":{\"Value\":\"2.463 V\",\"Enum\":0}, \"XMC Volt\":{\"Value\":\"12.222 V\",\"Enum\":0}, \"XMC 3p3\":{\"Value\":\"3.196 V\",\"Enum\":0}, \"Transmit H\":{\"Value\":\"57.326 dBm\",\"Enum\":0,\"MaxIndex\":0,\"Max\":\"4.282 dBm\",\"Min\":\"3.827 dBm\"}, \"Transmit V\":{\"Value\":\"53.309 dBm\",\"Enum\":0,\"MaxIndex\":1,\"Max\":\"-0.042 dBm\",\"Min\":\"-0.485 dBm\"}, \"DAC QI\":{\"Value\":\"0.881\",\"Enum\":0}, \"Waveform\":{\"Value\":\"x706\",\"Enum\":0}, \"UnderOver\":[0,233116], \"Lags\":[-1167035501,-1167035501,-1185559874], \"NULL\":[1602822], \"Pedestal AZ Interlock\":{\"Value\":true,\"Enum\":0}, \"Pedestal EL Interlock\":{\"Value\":true,\"Enum\":0}, \"VCP Active\":{\"Value\":true,\"Enum\":0}, \"Pedestal AZ\":{\"Value\":\"337.89 deg\",\"Enum\":0}, \"Pedestal EL\":{\"Value\":\"3.18 deg\",\"Enum\":0}, \"Pedestal Update\":\"251.021 Hz\", \"PedestalHealthEnd\":0, \"GPS Valid\":{\"Value\":true,\"Enum\":3}, \"GPS Latitude\":{\"Value\":\"35.2369165\",\"Enum\":3}, \"GPS Longitude\":{\"Value\":\"-97.4638230\",\"Enum\":3}, \"T-Box Bearing\":{\"Value\":\"-448.9 deg\", \"Enum\":0}, \"T-Box Temp\":{\"Value\":\"19.6 degC\", \"Enum\":0}, \"T-Box Pressure\":{\"Value\":\"985.0 hPa\", \"Enum\":0}, \"RF TRX Health\":{\"Value\":\"0x71\", \"Enum\":0}, \"RF Over Temp H\":{\"Value\":true, \"Enum\":0}, \"RF Over Temp V\":{\"Value\":false, \"Enum\":2}, \"RF VSWR H\":{\"Value\":true, \"Enum\":0}, \"RF VSWR V\":{\"Value\":true, \"Enum\":1}, \"STALO\":{\"Value\":true, \"Enum\":0}, \"tic\":\"31008358\", \"Heading Override\":{\"Value\":true,\"Enum\":0}, \"Sys Heading\":{\"Value\":\"180.75 deg\",\"Enum\":0}, \"GPS Override\":{\"Value\":true,\"Enum\":0}, \"Sys Latitude\":{\"Value\":\"35.2369467\",\"Enum\":0}, \"Sys Longitude\":{\"Value\":\"-97.4638167\",\"Enum\":0}, \"Log Time\":1570804519}"
};

// Local functions
static void handleSignals(int signal) {
    fprintf(stderr, "\nCaught %d\n", signal);
    R->wantActive = false;
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

static double timevalDiff(const struct timeval m, const struct timeval s) {
    return (double)m.tv_sec - (double)s.tv_sec + 1.0e-6 * ((double)m.tv_usec - (double)s.tv_usec);
}

// The busy run loop - the reporter
void *run(void *in) {
    int k;
    int g;
    float w;
    float o;
    float t;
    int16_t *n;
    int16_t *x;
    char *payload;

    // Let's do 15 FPS
    const int f = 15;

    useconds_t s = 1000000 / f;

    // Post health status about every 0.5s
    const int ht = 500000 / s;

    // Noise magnitude of 1000
    const int nm = 1000;
    
    // Gate count
    const int count = 1000;

    // Health depth is just the number of samples we have up there
    const int hdepth = sizeof(healthString) / sizeof(healthString[0]);

    // Memory allocation
    const int pulseCapacity = sizeof(uint8_t) + 2 * count * sizeof(int16_t);
    void *buf = malloc(30 * pulseCapacity);
    void *hbuf = malloc(hdepth * HEALH_CAPACITY);
    float *window = (float *)malloc(count * sizeof(float));
    int16_t *noise = (int16_t *)malloc(3 * count * sizeof(int16_t));
    
    tukeywin(window, count, 0.1);

    // Convert healthStrings to type + healthStrings
    for (k = 0; k < hdepth; k++) {
        payload = (char *)(hbuf + k * HEALH_CAPACITY);
        sprintf(payload, "%c%s", RadarHubTypeHealth, healthString[k]);
    }
    if (R->verbose > 1) {
        char message[60];
        for (k = 0; k < hdepth; k++) {
            payload = (char *)(hbuf + k * HEALH_CAPACITY);
            binaryString(message, payload, 30);
            printf("%s (%zu)\n", message, strlen(healthString[k]));
        }
    }

    // Some kind of pseudo-noise sequence
    for (k = 0; k < 3 * count; k++) {
        if (rand() % (int)(1.0 / 0.4) == 0) {
            g = rand() % 32000;
            noise[k] = rand() % g - g / 2;
        } else {
            noise[k] = rand() % (2 * nm) - nm;
        }
    }

    // Wait until the welcome message is received
    while (!R->ws->connected) {
        usleep(100000);
    }

    if (R->verbose) {
        printf("\033[38;5;9mBusy run loop\033[m\n");
    }

    double delta;
    struct timeval s0, s1;
    gettimeofday(&s1, NULL);
    usleep(s);
    int j = 1;
    while (R->wantActive) {
        // AScope samples
        payload = (char *)(buf + (j % 30) * pulseCapacity);
        payload[0] = RadarHubTypeScope;
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
        RKWebSocketSend(R->ws, payload, pulseCapacity);

        if (j % ht == 0) {
            payload = (char *)(hbuf + (j / ht) % hdepth * HEALH_CAPACITY);
            RKWebSocketSend(R->ws, payload, 1 + strlen(payload + 1));
        }

        if (j % f == 0) {
            gettimeofday(&s0, NULL);
            delta = timevalDiff(s0, s1);
            int e = (1000000 - (int)(1000000 * delta)) / 50;
            //printf("delta = %.2f ms  -> e = %d\n", 1.0e3 * delta, e);
            s1 = s0;
            s += e;
        }
        usleep(s);
        j++;
    }

    if (R->verbose) {
        printf("Run loop retired\n");
    }

    free(window);
    free(noise);
    free(hbuf);
    free(buf);

    return NULL;
}

void handleOpen(RKWebSocket *w) {
    if (R->verbose) {
        printf("ONOPEN\n");
    }
    int r;
    r = sprintf(R->welcome,
        "%c{"
            "\"radar\":\"%s\", "
            "\"command\":\"radarConnect\""
        "}",
        RadarHubTypeHandshake, R->name);
    RKWebSocketSend(R->ws, R->welcome, r);
    r = sprintf(R->control,
        "%c{"
            "\"name\": \"%s\", "
            "\"Controls\": ["
                "{\"Label\":\"Go\", \"Command\":\"t y\"}, "
                "{\"Label\":\"Stop\", \"Command\":\"t z\"}, "
                "{\"Label\":\"Try Me 1\", \"Command\":\"t w 1\"}, "
                "{\"Label\":\"Try Me 2\", \"Command\":\"t w 2\"}, "
                "{\"Label\":\"PRF 1,000 Hz (84 km)\", \"Command\":\"t prf 1000\"}, "
                "{\"Label\":\"PRF 1,475 Hz (75 km)\", \"Command\":\"t prf 1475\"}, "
                "{\"Label\":\"PRF 2,000 Hz (65 km)\", \"Command\":\"t prf 2000\"}, "
                "{\"Label\":\"PRF 3,000 Hz (40 km)\", \"Command\":\"t prf 3003\"}, "
                "{\"Label\":\"PRF 4,000 Hz (28 km)\", \"Command\":\"t prf 4000\"}, "
                "{\"Label\":\"PRF 5,000 Hz (17.6 km)\", \"Command\":\"t prf 5000\"}, "
                "{\"Label\":\"Stop Pedestal\", \"Command\":\"p stop\"}, "
                "{\"Label\":\"Park\", \"Command\":\"p point 0 90\"}, "
                "{\"Label\":\"DC PSU On\", \"Command\":\"h pow on\"}, "
                "{\"Label\":\"DC PSU Off\", \"Command\":\"h pow off\"}, "
                "{\"Label\":\"Measure Noise\", \"Command\":\"t n\"}, "
                "{\"Label\":\"Transmit Toggle\", \"Command\":\"t tx\"}, "
                "{\"Label\":\"10us pulse\", \"Command\":\"t w s10\"}, "
                "{\"Label\":\"12us LFM\", \"Command\":\"t w q0412\"}, "
                "{\"Label\":\"20us pulse\", \"Command\":\"t w s20\"}, "
                "{\"Label\":\"50us pulse\", \"Command\":\"t w s50\"}, "
                "{\"Label\":\"TFM + OFM\", \"Command\":\"t w ofm\"}, "
                "{\"Label\":\"OFM\", \"Command\":\"t w ofmd\"}, "
                "{\"Label\":\"1-tilt EL 2.4 deg @ 18 deg/s\", \"Command\":\"p vol p 2.4 300 18\"}, "
                "{\"Label\":\"5-tilt VCP @ 45 deg/s\", \"Command\":\"p vol p 2 300 45/p 4 300 45/p 6 300 45/p 8 300 45/p 10 300 45\"}, "
                "{\"Label\":\"5-tilt VCP @ 25 deg/s\", \"Command\":\"p vol p 2 300 25/p 4 300 25/p 6 300 25/p 8 300 25/p 10 300 25\"}, "
                "{\"Label\":\"5-tilt VCP @ 18 deg/s\", \"Command\":\"p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18\"}, "
                "{\"Label\":\"5-tilt VCP @ 12 deg/s\", \"Command\":\"p vol p 2 300 12/p 4 300 12/p 6 300 12/p 8 300 12/p 10 300 12\"}, "
                "{\"Label\":\"6-tilt VCP @ 18 deg/s\", \"Command\":\"p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18/p 12 300 18\"}"
            "]"
        "}",
        RadarHubTypeControl, R->name);
    RKWebSocketSend(R->ws, R->control, strlen(R->control));
}

void handleClose(RKWebSocket *W) {
    R->connected = false;
    if (R->verbose) {
        printf("ONCLOSE\n");
    }
}

void handleMessage(RKWebSocket *W, void *payload, size_t size) {
    if (R->verbose) {
        printf("ONMESSAGE \033[38;5;227m%s\033[m\n", (char *)payload);
    }
    if (strstr((char *)payload, "Welcome")) {
        R->connected = true;
        return;
    }
    int r = 0;
    if (!strcmp(payload, "t y")) {
        R->go = true;
        R->rate = 1.0f;
        r = sprintf(R->message, "%cACK %s", RadarHubTypeResponse, (char *)payload);
    } else if (!strcmp(payload, "t z")) {
        R->go = false;
        r = sprintf(R->message, "%cACK %s", RadarHubTypeResponse, (char *)payload);
    } else if (!strcmp(payload, "t w 1")) {
        R->go = true;
        R->rate = -2.5f;
        r = sprintf(R->message, "%cACK %s", RadarHubTypeResponse, (char *)payload);
    } else if (!strcmp(payload, "t w 2")) {
        R->go = true;
        R->rate = 5.0f;
        r = sprintf(R->message, "%cACK %s", RadarHubTypeResponse, (char *)payload);
    } else {
        r = sprintf(R->message, "%cNAK %s", RadarHubTypeResponse, (char *)payload);
    }
    if (R->verbose) {
        printf("REPLY \033[38;5;154m%s\033[m (%d)\n", R->message, r);
    }
    RKWebSocketSend(R->ws, R->message, r);
}

static void showHelp() {
    char name[] = __FILE__;
    *strrchr(name, '.') = '\0';
    printf("Data Generator for RadarHub\n"
           "\n"
           "dgen [options] [<address>:<port>]\n"
           "\n"
           "Examples:\n"
           "    dgen -n nancy radarhub.arrc.ou.edu:443\n"
           "    dgen -v -n bumblebee radarhub.arrc.ou.edu:443\n"
           "\n"
           "OPTIONS:\n"
           "     Unless specifically stated, all options are interpreted in sequence. Some\n"
           "     options can be specified multiples times for repetitions. For example, the\n"
           "     verbosity is increased by repeating the option multiple times.\n"
           "\n"
           "  -n, --name NAME        sets the radar name reporting to NAME.\n"
           "                         If not specified, the default name is 'demo'.\n"
           "\n"
           "  -s, --ssl              forces SSL to be on. Otherwise, it is inferred from\n"
           "                         the port nummber, i.e., 443 on, else off.\n"
           "\n"
           "  -v                     increases verbosity level.\n"
           "\n"
           "%s (RadarHub v" VERSION ")\n",
           name
           );
}

int main(int argc, const char *argv[]) {
    int k, s;
    char str[1024];

    // Reporter struct
    R = (RKReporter *)malloc(sizeof(RKReporter));
    memset(R, 0, sizeof(RKReporter));
    sprintf(R->name, "demo");
    R->wantActive = true;

    // Command line options
    struct option options[] = {
        {"help"              , no_argument      , NULL, 'h'},
        {"name"              , required_argument, NULL, 'n'},
        {"ssl"               , no_argument      , NULL, 's'},
        {"verbose"           , no_argument      , NULL, 'v'},
        {0, 0, 0, 0}
    };
    s = 0;
    for (k = 0; k < sizeof(options) / sizeof(struct option); k++) {
        struct option *o = &options[k];
        s += snprintf(str + s, 1023 - s, "%c%s", o->val, o->has_arg == required_argument ? ":" : (o->has_arg == optional_argument ? "::" : ""));
    }
    optind = 1;
    int opt, ind = 0;
    while ((opt = getopt_long(argc, (char * const *)argv, str, options, &ind)) != -1) {
        switch (opt) {
            case 'h':
                showHelp();
                exit(EXIT_SUCCESS);
            case 'n':
                strcpy(R->name, optarg);
                break;
            case 's':
                R->flag = RKWebSocketFlagSSLOn;
                break;
            case 'v':
                R->verbose++;
                break;
            default:
                break;
        }
    }

    if (optind == argc - 1) {
        strcpy(R->host, argv[optind]);
    } else {
        sprintf(R->host, "localhost:8000");
    }

    sprintf(R->address, "/ws/radar/%s/", R->name);

    R->ws = RKWebSocketInit(R->host, R->address, R->flag);
    RKWebSocketSetOpenHandler(R->ws, &handleOpen);
    RKWebSocketSetCloseHandler(R->ws, &handleClose);
    RKWebSocketSetMessageHandler(R->ws, &handleMessage);
    R->ws->verbose = R->verbose;

    // Catch Ctrl-C and some signals alternative handling
    signal(SIGINT, handleSignals);

    RKWebSocketStart(R->ws);

    pthread_t tid;
    pthread_create(&tid, NULL, run, NULL);

    while (R->wantActive) {
        usleep(100000);
    }

    RKWebSocketStop(R->ws);
    RKWebSocketFree(R->ws);

    free(R);

    exit(EXIT_SUCCESS);
}
