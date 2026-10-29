import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=(await readdir(new URL('../tests/',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
const child=spawn(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',windowsHide:true});
child.on('error',()=>{console.error('테스트 실행기를 시작하지 못했습니다.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
