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

let gruposCache = [];


// =====================================
// INICIAR WHATSAPP
// =====================================

function iniciarWhatsApp(){

    client = new Client({

    authStrategy:new LocalAuth(),

    takeoverOnConflict:true,

    takeoverTimeoutMs:60000,

        puppeteer:{

            headless:true,

timeout:120000,

            args:[

    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage'

]

        },

        authTimeoutMs:120000

    });


    // =====================================
    // QR CODE
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
            // CARREGAR GRUPOS
            // =====================================

            setTimeout(async()=>{

                try{

                    if(!client) return;

const chats = await client.getChats();

if(!chats || chats.length === 0){

    console.log(
        'Nenhum grupo encontrado'
    );

    return;

}

                    const grupos = chats

                    .filter(chat => chat.isGroup)

                    .map(chat => ({

                        id:
                        chat.id._serialized,

                        name:
                        chat.name

                    }));

                    gruposCache = grupos;

                    io.emit(
                        'groups',
                        grupos
                    );

                    console.log(

                        `${grupos.length} grupos carregados`

                    );

                }catch(err){

                    console.log(
                        'Erro ao carregar grupos'
                    );

                }

            },60000);

        }

    );


    // =====================================
    // DESCONECTADO
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
    // START
    // =====================================

    client.initialize();

}


// =====================================
// SOCKET
// =====================================

io.on(

    'connection',

    (socket)=>{

    if(gruposCache.length > 0){

    socket.emit(
        'groups',
        gruposCache
    );

}

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

                        `Iniciando envio grupos (${grupos.length})`

                    );

                    let enviados = 0;

                    let falhados = 0;

                    const total =
                    grupos.length;


                    for(const grupoId of grupos){

                        if(pausado){

                            console.log(
                                'Envio pausado'
                            );

                            break;

                        }

                        try{

                            const chat =

                            await client.getChatById(
                                grupoId
                            );


                            await chat.sendStateTyping();


                            await delay(

                                randomDelay(
                                    3000,
                                    5000
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

                                await client.sendMessage(

                                    grupoId,

                                    media,

                                    {

                                        caption:
                                        mensagem

                                    }

                                );

                            }

                            // =====================================
                            // TEXTO
                            // =====================================

                            else{

                                await client.sendMessage(

                                    grupoId,

                                    mensagem

                                );

                            }


                            enviados++;

                            console.log(

                                `Mensagem enviada grupo ${grupoId}`

                            );


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


                            await chat.clearState();


                            await delay(

                                randomDelay(
                                    15000,
                                    25000
                                )

                            );

                        }catch(err){

                            falhados++;

                            console.log(
                                'Erro grupo:',
                                err
                            );

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

                        mensagem,

                        imagem

                    } = data;

                    console.log(

                        `Iniciando lista (${numeros.length})`

                    );

                    let enviados = 0;

                    let falhados = 0;

                    const total =
                    numeros.length;


                    for(let numero of numeros){

                        if(pausado){

                            console.log(
                                'Lista pausada'
                            );

                            break;

                        }

                        try{

                            // =====================================
                            // LIMPAR
                            // =====================================

                            numero = numero

                            .replace(/\D/g,'')

                            .trim();


                            // =====================================
                            // ADD 55
                            // =====================================

                            if(

                                !numero.startsWith('55')

                            ){

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


                            await delay(

                                randomDelay(
                                    3000,
                                    5000
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

                                await client.sendMessage(

                                    chatId,

                                    media,

                                    {

                                        caption:
                                        mensagem

                                    }

                                );

                            }

                            // =====================================
                            // TEXTO
                            // =====================================

                            else{

                                await client.sendMessage(

                                    chatId,

                                    mensagem

                                );

                            }


                            enviados++;

                            console.log(
                                `Mensagem enviada ${numero}`
                            );


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


                            await delay(

                                randomDelay(
                                    12000,
                                    18000
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
        // PAUSAR
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
        // PAUSAR BOT
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
        // START BOT
        // =====================================

        socket.on(

            'start-bot',

            async()=>{

                try{

                    if(!client){

                        iniciarWhatsApp();

                    }else{

                        try{

                            await client.destroy();

                        }catch(e){}

                        iniciarWhatsApp();

                    }

                    console.log(
                        'BOT INICIADO'
                    );

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
// RANDOM DELAY
// =====================================

function randomDelay(min,max){

    return Math.floor(

        Math.random() *

        (max - min + 1)

    ) + min;

}
