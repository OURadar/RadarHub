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
check_user_process radarhub python dgen | textout "Processes" seagreen
echo
systemctl status supervisor --no-pager
echo
show_log_by_latest_line_count frontend 10 228
#show_log_by_latest_line_count backhaul 10 214
echo -e "\033[4;38;5;214m/home/radarhub/log/backhaul.log\033[m"
tail -n 10 /home/radarhub/log/backhaul.log

