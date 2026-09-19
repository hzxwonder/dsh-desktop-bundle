#!/usr/bin/env node
import net from 'node:net';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const directory=process.env.DSH_PAPER_DATA || join(process.env.DSH_HOME || join(homedir(),'.dsh-desktop'),'latex-studio');
const {socket}=JSON.parse(await readFile(join(directory,'automation.json'),'utf8'));
let input='';for await(const b of process.stdin)input+=b;
const request=JSON.parse(input);const s=net.connect(socket);let output='';s.setTimeout(180000,()=>s.destroy(new Error('接口超时')));s.on('connect',()=>s.write(JSON.stringify(request)+'\n'));s.on('data',b=>output+=b);s.on('error',e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});s.on('end',()=>{process.stdout.write(output);try{if(!JSON.parse(output).ok)process.exitCode=1;}catch{process.exitCode=1;}});
