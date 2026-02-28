#!/usr/bin/env bash

nvm i v24.13.1
nvm use v24.13.1

node --env-file=../.env ../src/server.js