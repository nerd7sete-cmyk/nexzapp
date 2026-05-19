const express = require('express');

const http = require('http');

const { Server } = require('socket.io');

const {
Client,
LocalAuth,
MessageMedia
} = require('whatsapp-web.js');

const qrcode = require('qrcode');


// =====================================
// APP
// =====================================

const app = express();

const server = http.createServer(app);

const io = new Server(server,{

cors:{
origin:"*"
}

});


// =====================================
// EXPRESS
// =====================================

app.use(express.static('public'));

app.use(express.json({

limit:'100mb'

}));


// =====================================
// CONTROLE
// =====================================

let pausado = false;

let client = null;


// =====================================
// START WHATSAPP
// =====================================

function iniciarWhatsApp(){

client = new Client({

authStrategy:new LocalAuth(),

puppeteer:{

headless:false,

args:[

'--no-sandbox',
'--disable-setuid-sandbox',
'--disable-dev-shm-usage'

]

},

authTimeoutMs:120000

});


// =====================================
// QR
// =====================================

client.on(

'qr',

async(qr)=>{

console.log(
'QR CODE GERADO'
);

const qrImage =

await qrcode.toDataURL(qr);

io.emit(
'qr',
qrImage
);

}

);


// =====================================
// READY
// =====================================

client.on(

'ready',

async()=>{

console.log(
'WhatsApp conectado'
);

io.emit(
'ready'
);


// =====================================
// GRUPOS
// =====================================

setTimeout(async()=>{

try{

const chats =

await client.getChats();

const grupos = chats

.filter(chat => chat.isGroup)

.map(chat => ({

id:
chat.id._serialized,

name:
chat.name

}));

io.emit(
'groups',
grupos
);

console.log(

`${grupos.length} grupos carregados`

);

}catch(err){

console.log(
'Erro grupos'
);

console.log(err);

}

},5000);

}

);


// =====================================
// DISCONNECTED
// =====================================

client.on(

'disconnected',

(reason)=>{

console.log(
'WhatsApp desconectado:',
reason
);

}

);


// =====================================
// AUTH FAILURE
// =====================================

client.on(

'auth_failure',

(msg)=>{

console.log(
'ERRO AUTH:',
msg
);

}

);


// =====================================
// INITIALIZE
// =====================================

client.initialize();

}


// =====================================
// SOCKET
// =====================================

io.on(

'connection',

(socket)=>{

console.log(
'Novo cliente conectado'
);


// =====================================
// STATUS
// =====================================

if(client){

try{

if(client.info){

socket.emit(
'ready'
);

}

}catch(e){

console.log(e);

}

}


// =====================================
// DISPARO GRUPOS
// =====================================

socket.on(

'send-message',

async(data)=>{

pausado = false;

try{

const {

grupos,
mensagem,
imagem

} = data;

console.log(

`Iniciando grupos (${grupos.length})`

);

let enviados = 0;

let falhados = 0;

const total =
grupos.length;


// =====================================
// LOOP
// =====================================

for(const grupoId of grupos){

if(pausado){

console.log(
'Envio pausado'
);

break;

}

try{

console.log(
`Grupo ${grupoId}`
);


// =====================================
// CHAT
// =====================================

const chat =

await client.getChatById(
grupoId
);


// =====================================
// ONLINE
// =====================================

await client.sendPresenceAvailable();

await chat.sendStateTyping();


// =====================================
// DELAY DIGITANDO
// =====================================

await delay(

randomDelay(
6000,
12000
)

);


// =====================================
// IMAGEM
// =====================================

if(imagem){

const media =

new MessageMedia(

imagem.mimetype,

imagem.data,

imagem.filename

);

const resposta =

await client.sendMessage(

grupoId,

media,

{

caption:
mensagem

}

);

console.log(

'IMAGEM ENVIADA:',
resposta.id.id

);

}


// =====================================
// TEXTO
// =====================================

else{

const resposta =

await client.sendMessage(

grupoId,

mensagem

);

console.log(

'TEXTO ENVIADO:',
resposta.id.id

);

}


// =====================================
// CLEAR
// =====================================

await chat.clearState();


// =====================================
// PROGRESS
// =====================================

enviados++;

io.emit(

'group-progress',

{

enviados,
falhados,
total,

restante:

total -

enviados -

falhados

}

);

console.log(

`Mensagem enviada grupo ${grupoId}`

);


// =====================================
// PAUSA AUTOMATICA
// =====================================

if(

enviados % 15 === 0

){

const pausa =

randomDelay(
180000,
360000
);

console.log(

`Pausa automática grupos ${pausa/1000}s`

);

await delay(pausa);

}


// =====================================
// DELAY HUMAN
// =====================================

await delay(

randomDelay(
35000,
70000
)

);

}catch(err){

falhados++;

console.log(
'Erro grupo:'
);

console.log(err);

}

}

console.log(
'Disparo grupos finalizado'
);

}catch(err){

console.log(err);

}

}

);


// =====================================
// DISPARO LISTA
// =====================================

socket.on(

'send-list',

async(data)=>{

pausado = false;

try{

const {

numeros,
campanhas

} = data;

console.log(

`Iniciando lista (${numeros.length})`

);

let enviados = 0;

let falhados = 0;

const total =
numeros.length;


// =====================================
// CAMPANHA SEQUENCIAL
// =====================================

let campanhaIndex = 0;


// =====================================
// LOOP
// =====================================

for(let numero of numeros){

if(pausado){

console.log(
'Lista pausada'
);

break;

}

try{

numero = numero

.replace(/\D/g,'')

.trim();

if(!numero.startsWith('55')){

numero =
'55' + numero;

}

console.log(
`Verificando ${numero}`
);


// =====================================
// VALIDAR
// =====================================

const numberId =

await client.getNumberId(
numero
);

if(!numberId){

falhados++;

console.log(
`Número inválido ${numero}`
);

continue;

}

const chatId =
numberId._serialized;


// =====================================
// CAMPANHA
// =====================================

const campanha =

campanhas[campanhaIndex];

campanhaIndex++;

if(

campanhaIndex >=
campanhas.length

){

campanhaIndex = 0;

}


// =====================================
// ONLINE
// =====================================

await client.sendPresenceAvailable();

const chat =

await client.getChatById(
chatId
);

await chat.sendStateTyping();


// =====================================
// DELAY DIGITANDO
// =====================================

await delay(

randomDelay(
5000,
10000
)

);


// =====================================
// IMAGEM
// =====================================

if(

campanha.imagem &&

campanha.imagem.data

){

const media =

new MessageMedia(

campanha.imagem.mimetype,

campanha.imagem.data,

campanha.imagem.filename

);

const resposta =

await client.sendMessage(

chatId,

media,

{

caption:
campanha.mensagem

}

);

console.log(

'IMAGEM ENVIADA:',
resposta.id.id

);

}


// =====================================
// TEXTO
// =====================================

else{

const resposta =

await client.sendMessage(

chatId,

campanha.mensagem

);

console.log(

'TEXTO ENVIADO:',
resposta.id.id

);

}


// =====================================
// CLEAR
// =====================================

await chat.clearState();


// =====================================
// PROGRESS
// =====================================

enviados++;

io.emit(

'list-progress',

{

enviados,
falhados,
total,

restante:

total -

enviados -

falhados

}

);

console.log(

`Mensagem enviada ${numero}`

);


// =====================================
// PAUSA AUTOMATICA
// =====================================

if(

enviados % 20 === 0

){

const pausa =

randomDelay(
180000,
420000
);

console.log(

`Pausa automática lista ${pausa/1000}s`

);

await delay(pausa);

}


// =====================================
// DELAY HUMAN
// =====================================

await delay(

randomDelay(
25000,
45000
)

);

}catch(err){

falhados++;

console.log(
`Erro ${numero}`
);

console.log(err);

}

}

console.log(
'Disparo lista finalizado'
);

}catch(err){

console.log(err);

}

}

);


// =====================================
// PAUSE
// =====================================

socket.on(

'pause',

()=>{

pausado = true;

console.log(
'Pausado manualmente'
);

}

);


// =====================================
// PAUSE BOT
// =====================================

socket.on(

'pause-bot',

async()=>{

try{

pausado = true;

if(client){

await client.destroy();

console.log(
'BOT PAUSADO'
);

}

}catch(e){

console.log(e);

}

}

);


// =====================================
// RELOAD QR
// =====================================

socket.on(

'reload-qr',

async()=>{

try{

if(client){

await client.destroy();

}

iniciarWhatsApp();

console.log(
'Reconectando'
);

}catch(err){

console.log(err);

}

}

);

}

);


// =====================================
// START
// =====================================

iniciarWhatsApp();


// =====================================
// SERVER
// =====================================

server.listen(

3000,

()=>{

console.log(

'Servidor rodando na porta 3000'

);

}

);


// =====================================
// DELAY
// =====================================

function delay(ms){

return new Promise(resolve=>{

setTimeout(resolve,ms);

});

}


// =====================================
// RANDOM
// =====================================

function randomDelay(min,max){

return Math.floor(

Math.random() *

(max - min + 1)

) + min;

}