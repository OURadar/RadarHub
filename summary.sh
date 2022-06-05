#!/bin/bash
#
# This script generates a summary of important process and shows the
# latest logs from selected processes
#
# Requirement:
# blib-sh (https://git.arrc.ou.edu/cheo4524/blib-sh.git)
#

if [ "${1}" == "bbot" ]; then
	export TERM=xterm-256color
	export SCREEN_WIDTH=120
fi

if [ -z "${BLIB_HOME}" ]; then BLIB_HOME="${HOME}/Developer/blib-sh"; fi; . ${BLIB_HOME}/blib.sh

##############
#
#   M A I N
#
##############

clear

check_user_process radarhub python dgen fifoshare fiforead fifo2db | textout "Processes" seagreen

if [ -f /lib/systemd/system/redis-server.service ]; then
	echo
	systemctl status redis --no-pager --lines 4
fi

if [ -f /lib/systemd/system/supervisor.service ]; then
	echo
	systemctl status supervisor --no-pager --lines 4
fi

echo

if [ "${DJANGO_DEBUG}" == "true" ]; then
	# Logs through common.dailylog with dailyfile = True
	folder="${HOME}/logs"
	if [ -d ${folder} ]; then
		file=$(ls -t ${folder}/fifo2db-* | sort | tail -n 1)
		if [ ! -z "${file}" ]; then
			echo -e "\033[1;4;38;5;45m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
		file=$(ls -t ${folder}/dbtool-* | sort | tail -n 1)
		if [ ! -z "${file}" ]; then
			echo -e "\033[1;4;38;5;45m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
	fi
else
	# Supervisord logging
	folder="/var/log/radarhub"
	if [ -d ${folder} ]; then
		file="${folder}/frontend.log"
		if [ -f ${file} ]; then
			echo -e "\033[4;38;5;228m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
		file="${folder}/backhaul.log"
		if [ -f ${file} ]; then
			echo -e "\033[4;38;5;214m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
		file="${folder}/fifo2db.log"
		if [ -f ${file} ]; then
			echo -e "\033[4;38;5;45m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
		file="${folder}/dbtool.log"
		if [ -f ${file} ]; then
			echo -e "\033[4;38;5;45m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
	fi
fi
