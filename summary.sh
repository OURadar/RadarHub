#!/bin/bash
#
# This script generates a summary of important process and shows the
# latest logs from selected processes
#

if [ -z "${BLIB_HOME}" ]; then BLIB_HOME="${HOME}/Developer/blib-sh"; fi; . ${BLIB_HOME}/blib.sh

folder="/home/radarhub/log"

if [ ! -d ${folder} ]; then
	folder="${HOME}/log"
fi

##############
#
#   M A I N
#
##############

clear
check_user_process radarhub dgen | textout "Processes" seagreen
echo
systemctl status supervisor backhaul dgen --no-pager
echo
show_log_by_latest_line_count frontend 10 228
#journalctl -n 10 -u backhaul.service | textout "Backhaul" 118

