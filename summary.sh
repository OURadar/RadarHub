#!/bin/bash
#
# This script generates a summary of important process and shows the
# latest logs from selected processes
#
# Requirement:
# blib-sh (https://git.arrc.ou.edu/cheo4524/blib-sh.git)
#

if [[ -z "${TERM}" || "${TERM}" == "dumb" ]]; then
	TERM=xterm-256color
fi

if [ ! -z "${1}" ]; then
	if [ "${1}" == "-" ]; then
		TEXTOUT_FILL=FALSE
		SCREEN_WIDTH=200
	else
		SCREEN_WIDTH=${1}
	fi
fi

if [ -z "${BLIB_HOME}" ]; then BLIB_HOME="${HOME}/Developer/blib-sh"; fi; . ${BLIB_HOME}/blib.sh

home_log="${HOME}/logs"
var_log="/var/log/radarhub"

function overview() {
	clear

	check_user_process radarhub python dgen fifoshare fiforead fifo2db | textout "Processes" seagreen

	if [ -f /lib/systemd/system/redis-server.service ]; then
		echo
		systemctl status redis --no-pager --lines 0
	fi

	if [ -f /lib/systemd/system/supervisor.service ]; then
		echo
		systemctl status supervisor --no-pager --lines 0
	fi

	echo

	if [[ "${DJANGO_DEBUG}" == "true" && -d "${home_log}" ]]; then
		# Logs through common.dailylog with dailyfile = True
		folder="${HOME}/logs"
		file=$(ls -t ${folder}/fifo2db-* 2>/dev/null | sort | tail -n 1)
		if [ ! -z "${file}" ]; then
			echo -e "\033[1;4;38;5;45m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
		file=$(ls -t ${folder}/dbtool-* 2>/dev/null | sort | tail -n 1)
		if [ ! -z "${file}" ]; then
			echo -e "\033[1;4;38;5;45m${file}\033[m"
			tail -n 10 ${file}
			echo
		fi
	elif [ -d "${var_log}" ]; then
		# Supervisord logging
		folder=${var_log}
		file="${folder}/frontend.log"
		if [ -f ${file} ]; then
			echo -e "\033[4;38;5;45m${file}\033[m"
			tail -n 7 ${file}
			echo
		fi
		file="${folder}/backhaul.log"
		if [ -f ${file} ]; then
			echo -e "\033[4;38;5;45m${file}\033[m"
			tail -n 7 ${file}
			echo
		fi
		# file="${folder}/access.log"
		# file="/var/log/nginx/access.log"
		# if [ -f ${file} ]; then
		# 	echo -e "\033[4;38;5;45m${file}\033[m"
		# 	tail -n 7 ${file} | logparse.py
		# 	echo
		# fi
		# file="${folder}/fifo2db-v1.log"
		# if [ -f ${file} ]; then
		# 	echo -e "\033[4;38;5;45m${file}\033[m"
		# 	tail -n 7 ${file}
		# 	echo
		# fi
		file="${folder}/fifo2db.log"
		if [[ -f ${file} && $(stat -c %s ${file}) -gt 0 ]]; then
			echo -e "\033[4;38;5;45m${file}\033[m"
			tail -n 7 ${file}
			echo
		elif [ -f ${file}.1.gz ]; then
			echo -e "\033[4;38;5;45m${file}.1.gz\033[m"
			zcat ${file}.1.gz | tail -n 7
			echo
		fi
		file="${folder}/dbtool.log"
		if [[ -f ${file} && $(stat -c %s ${file}) -gt 0 ]]; then
			echo -e "\033[4;38;5;45m${file}\033[m"
			tail -n 7 ${file}
			echo
		elif [ -f ${file}.1.gz ]; then
			echo -e "\033[4;38;5;45m${file}.1.gz\033[m"
			zcat ${file}.1.gz | tail -n 7
			echo
		fi
	fi
}

function follow() {
	args=""
	folder=${var_log}
	for item in "frontend" "access" "backhaul" "fifo2db"; do
		file="${folder}/${item}.log"
		if [ -f ${file} ]; then
			args="${args} -f ${file}"
		fi
	done
	if [ ! -z "${args}" ]; then
		args=${args% }
		command="tail ${args# }"
		echo -e "\033[38;5;45m${command}\033[m"
		eval ${command}
	fi
}

##############
#
#   M A I N
#
##############

if [ ${1} == "t" ]; then
	follow
else
	overview
fi
