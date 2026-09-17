#!/usr/bin/env node
import {connect} from 'node:net';

const socket = connect(process.env.DSH_ASKPASS_SOCKET);
socket.setTimeout(5000, () => { socket.destroy(); process.exitCode = 1; });
socket.on('connect', () => socket.write(process.env.DSH_ASKPASS_NONCE + '\n'));
socket.on('data', data => process.stdout.write(data));
socket.on('error', () => { process.exitCode = 1; });
