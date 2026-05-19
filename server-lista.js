const express = require('express');

const http = require('http');

const { Server } = require('socket.io');

const {
Client,
LocalAuth,
MessageMedia
} = require('whatsapp-web.js');

const qrcode = require('qrcode');


// ======================================
// APP
// ======================================

const app = express();

const server = http.createServer(app);

const io = new Server(server,{

cors:{
origin:"*"
}

});


// ======================================
// EXPRESS
// ======================================

app.use(express.static('public'));

app.use(express.json({

limit:'100mb'

}));


// ======================================
// CONTROLE
// ======================================

let pausado = false;

let client = null;


// ======================================
// START WHATSAPP
// ======================================

function iniciarWhatsApp(){

client = new Client({

authStrategy:new LocalAuth({

clientId:'nexzapp'

}),

puppeteer:{

headless:true,

executablePath:
'/usr/bin/google-chrome-stable',

args:[

'--no-sandbox',

'--disable-setuid-sandbox',

'--disable-dev-shm-usage',

'--disable-gpu',

'--disable-software-rasterizer',

'--disable-extensions',

'--disable-background-networking',

'--disable-background-timer-throttling',

'--disable-renderer-backgrounding',

'--disable-features=site-per-process',

'--disable-web-security',

'--no-first-run',

'--no-zygote',

'--single-process'

]

},

authTimeoutMs:120000,

restartOnAuthFail:true

});


// ======================================
// QR
// ======================================

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


// ======================================
// READY
// ======================================

client.on(

'ready',

async()=>{

console.log(
'WhatsApp conectado'
);

io.emit(
'ready'
);


// ======================================
// GRUPOS
// ======================================

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


// ======================================
// AUTH
// ======================================

client.on(

'authenticated',

()=>{

console.log(
'WhatsApp autenticado'
);

}

);


// ======================================
// FAILURE
// ======================================

client.on(

'auth_failure',

(msg)=>{

console.log(
'ERRO AUTH:',
msg
);

}

);


// ======================================
// DISCONNECTED
// ======================================

client.on(

'disconnected',

(reason)=>{

console.log(
'WhatsApp desconectado:',
reason
);

setTimeout(()=>{

iniciarWhatsApp();

},5000);

}

);


// ======================================
// INITIALIZE
// ======================================

client.initialize();

}


// ======================================
// SOCKET
// ======================================

io.on(

'connection',

(socket)=>{

console.log(
'Novo cliente conectado'
);


// ======================================
// STATUS
// ======================================

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


// ======================================
// ENVIAR GRUPOS
// ======================================

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

let enviados = 0;

let falhados = 0;

const total =
grupos.length;


for(const grupoId of grupos){

if(pausado) break;

try{

const chat =

await client.getChatById(
grupoId
);

await client.sendPresenceAvailable();

await chat.sendStateTyping();

await delay(

randomDelay(
5000,
10000
)

);


// ======================================
// IMAGEM
// ======================================

if(imagem){

const media =

new MessageMedia(

imagem.mimetype,

imagem.data,

imagem.filename

);

await client.sendMessage(

grupoId,

media,

{

caption:
mensagem

}

);

}else{

await client.sendMessage(

grupoId,

mensagem

);

}

await chat.clearState();

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

await delay(

randomDelay(
25000,
60000
)

);

}catch(err){

falhados++;

console.log(err);

}

}

}catch(err){

console.log(err);

}

}

);


// ======================================
// PAUSE
// ======================================

socket.on(

'pause',

()=>{

pausado = true;

console.log(
'Pausado'
);

}

);


// ======================================
// RELOAD QR
// ======================================

socket.on(

'reload-qr',

async()=>{

try{

if(client){

await client.destroy();

}

iniciarWhatsApp();

}catch(err){

console.log(err);

}

}

);

}

);


// ======================================
// START
// ======================================

iniciarWhatsApp();


// ======================================
// SERVER
// ======================================

server.listen(

3000,

()=>{

console.log(

'Servidor rodando na porta 3000'

);

}

);


// ======================================
// DELAY
// ======================================

function delay(ms){

return new Promise(resolve=>{

setTimeout(resolve,ms);

});

}


// ======================================
// RANDOM
// ======================================

function randomDelay(min,max){

return Math.floor(

Math.random() *

(max - min + 1)

) + min;

}
