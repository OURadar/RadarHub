FROM python:3.12.9-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/home/radarhub

RUN apt -y update && apt install -y nodejs npm \
    libldap2-dev libsasl2-dev libssl-dev

COPY ./requirements.txt ${HOME}/

WORKDIR ${HOME}

RUN pip install -U pip
RUN pip install -r requirements.txt
