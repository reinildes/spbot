var express = require("express");
var request = require("request");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var bodyParser = require("body-parser");
var fs = require('fs');
var mysql = require('mysql');
var ftpClient = require('ftp-client');

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));
app.set('json spaces', 2);

var name = null;
const serverUrl = "https://raychat.herokuapp.com/";
var reclamacaoMap = new Map();
const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Server index page
app.get("/", function (req, res) {
    res.send("Deployed!");
});
// Facebook Webhook Used for verification
app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match.");
        res.sendStatus(403);
    }
});

app.get("/img", function(req, res){
    var img = req.query.img;
    res.sendFile("./"+img, {root: __dirname+'/img/'});
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    console.log("webhook triggered")
    // Make sure this is a page subscription
    if (req.body.object == "page") {
        // Iterate over each entry There may be multiple entries if batched
        req.body.entry.forEach(function(entry) {
            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                console.log("event");
                console.log(event);
                if (event.postback) {
                    processPostback(event);
                } else if (event.message) {
                    processMessage(event);
                }
            });
        });
        res.sendStatus(200);
    }
});

function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;
    console.log("Entering processPostback");
    console.log("Received message from senderId: " + senderId);

    var formattedMsg = payload.toLowerCase().trim();
    switch(formattedMsg){
        case "comecar":
            mensagemDeBoasVindas(senderId);
            break;
        case "desmatamento":
        case "desperdicio":
        case "lixo":
        case "maltrato":
        case "queimadas":
            reclamacaoRepository('tipo', formattedMsg, senderId);
            askForTitle(senderId);
            break;
        default:
            weirdRequest(senderId);
    }   
}

function processMessage(event) {
    if (!event.message.is_echo) {
        var message = event.message;
        var senderId = event.sender.id;
        var step = reclamacaoMap.get(senderId)==null?'':reclamacaoMap.get(senderId).step;

        console.log("Received message from senderId: " + senderId);
        console.log("Message is: " + JSON.stringify(message));

        console.log('step');
        console.log(step);

        // You may get a text or attachment but not both
        if (message.text) {
            var formattedMsg = message.text.toLowerCase().trim();
            
            if(formattedMsg =="começar"||formattedMsg=="comecar"||formattedMsg=="oi"||formattedMsg=="ola"){
                mensagemDeBoasVindas(senderId);
                return;
            }

            console.log('formattedMsg');
            console.log(formattedMsg);
            console.log('message.payload');
            console.log(message.payload);
    
            switch (step) {
                case "titulo":
                    reclamacaoRepository('titulo', formattedMsg, senderId);
                    askForHistory(senderId);
                    break;
                case "historia":
                    reclamacaoRepository('historia', formattedMsg, senderId);
                    askForDate(senderId);
                    break;    
                case "data":
                    reclamacaoRepository('data', formattedMsg, senderId);
                    askForLocation(senderId);
                    break;
                case "localizacao":
                    if(message.quick_reply.payload =='informarLocalizacao'){
                        showInformLocation(senderId);
                    }else if(message.quick_reply.payload =='enviarLocalizacao'){
                        showSendLocation(senderId);
                    }
                    break;
                case "informarLocalizacao":
                    reclamacaoRepository('localizacao', formattedMsg, senderId);
                    askForMidia(senderId);
                    break;
                case "midia":
                    if(['não', 'nao'].indexOf(formattedMsg) > -1){
                        askForMoreInfo(senderId);
                    }else{
                        weirdRequest(senderId);
                    }
                    break;    
                case "pessoais":
                    reclamacaoRepository('pessoal', formattedMsg, senderId);
                    if(formattedMsg=="sim"){
                        askForAge(senderId);
                    }else{
                        mensagemAgradecimento(senderId);
                    }
                    break;  
                case "idade":
                    reclamacaoRepository('idade', formattedMsg, senderId);
                    askForSexOrientation(senderId);
                    break;
                case "sexo":
                    reclamacaoRepository('sexo', formattedMsg, senderId);
                    askForSugestion(senderId);
                    break;
                case "sugestao":
                    if(['não', 'nao'].indexOf(formattedMsg) == -1){
                        reclamacaoRepository('sugestao', formattedMsg, senderId);
                    }    
                    mensagemAgradecimento(senderId);
                    break;
                default:
                    weirdRequest(senderId);
            }
        } else if (message.attachments) {
            var type = step;
            switch (type) {
                case "enviarLocalizacao":
                    reclamacaoRepository('localizacao', message.attachments[0].payload, senderId);
                    askForMidia(senderId);
                    break;
                case "midia":
                    saveMedia(senderId, message.attachments[0].payload.url);
                    askForMoreInfo(senderId);
                    break;    
                default:       
                    weirdRequest(senderId);
            }    
        }
    }
}

function sendMessage(recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });    
}

function getUserName( senderId){

    if (reclamacaoMap.get(senderId).reclamacao.name != null){
        return name;
    }

    var r = new XMLHttpRequest();
    r.open('GET', "https://graph.facebook.com/v2.6/" + senderId 
         +"?access_token="+ process.env.PAGE_ACCESS_TOKEN
         +"&fields=first_name",
          false);           
    r.send(null);

    if (r.status === 200) {
        name = JSON.parse(r.responseText).first_name;
    }
    return name;   
}

function mensagemDeBoasVindas(senderId){
    reclamacaoRepository('name', getUserName(senderId), senderId); 
    setStep(null, senderId);

    var msg = 'Oi '+getUserName(senderId) + ', sua contribuição é muito importante para nós!';
    sendMessage(senderId, {text: msg});

    showTypingThenSend(senderId, true, () => {
        sendMessage(senderId, {text: "Por favor escolha entre as categorias abaixo:"});
        displayCategories(senderId);    
    });
}

function displayCategories(userId){
    message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                image_aspect_ratio:"square",
                elements: [{
                        title: "Desperdício de água",                   
                        image_url: serverUrl+"img?img=desperdicio.png&time="+new Date()*1,
                        buttons: [{
                            type: "postback",
                            title: "Fazer Reclamação",
                            payload: "desperdicio"
                        }]
                    },{
                    title: "Corte indevido de árvores",                  
                    image_url: serverUrl+"img?img=desmatamento.png&time="+new Date()*1,
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "desmatamento"
                    }]
                },{
                    title: "Descarte de lixo em local inapropriado",                   
                    image_url: serverUrl+"img?img=lixo.png&time="+new Date()*1,
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "lixo"
                    }]
                },{
                    title: "Maltrato de animais",
                    image_url: serverUrl+"img?img=maltrato.png&time="+new Date()*1,
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "maltrato"
                    }]
                },{
                    title: "Queimadas",                   
                    image_url: serverUrl+"img?img=queimadas.png&time="+new Date()*1,
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "queimadas"
                    }]
                }
            ]
            }
        }
    };
    sendMessage(userId, message);
}

function askForTitle(senderId){
    setStep('titulo', senderId);
    sendMessage(senderId, {text: "Beleza! E que título você daria para essa reclamação?"});
}

function askForHistory(senderId){
    setStep('historia', senderId);
    sendMessage(senderId, {text: "Okay.. Me conte sua história"});
}

function askForDate(senderId){
    setStep('data', senderId);
    var daysArray = [];

    for(var i = 0; i <= 9; i++){
        var date = new Date();
        var newDate = new Date(date.setDate(date.getDate()-i));
        var dateFormatted = formatDate(newDate);
        var aDay = {    
            content_type:"text",
            title: dateFormatted,
            payload: dateFormatted,
            image_url: serverUrl+"img?img=cal.png&time="+new Date()*1
        };
        daysArray.push(aDay);  
    }

    message = {
        text: 'Humm... E quando foi que isso aconteceu ?',
        quick_replies: daysArray  
    };
    sendMessage(senderId, message);
}

function askForMidia(senderId){
    setStep('midia', senderId);
    sendMessage(senderId, {text: "Beleza! Você tem um vídeo ou foto do ocorrido? Envie um arquivo ou responda 'Não' caso deseje não enviar"});
}

function saveMedia(senderId, imageUrl){
    request.get({url: imageUrl, encoding: 'binary'}, function (err, response, body) {
        var ext = imageUrl.substring(imageUrl.lastIndexOf('.'), imageUrl.lastIndexOf('?'));
        var fileName = '/img/'+new Date()*1+'_img'+ext;
        fs.writeFile(__dirname+fileName, body, 'binary', function(err) {
            if (err) throw err;
            console.log('File salved!');
            reclamacaoRepository('fileName', fileName, senderId);
            uploadViaFtp(fileName);
        }); 
    });
}

function askForMoreInfo(senderId){
    setStep('pessoais', senderId);
    sendMessage(senderId, {text: "Obrigado! Já recebi aqui a sua reclamação!"});
    showTypingThenSend(senderId, true, () =>{
        message = yesNoQuestion('Para fins estatísticos, você gostaria de contribuir compartilhando algumas informações pessoais ?');
        sendMessage(senderId, message);
    });
}

function askForAge(senderId){
    setStep('idade', senderId);
    sendMessage(senderId, {text: "Então vamos lá!"});
    showTypingThenSend(senderId, true, ()=>{
        message = {
            text: 'Qual a sua faixa etária ?',
            quick_replies:[{    
                content_type:"text",
                title: "Menor que 18 anos",
                payload: "menor que 18 anos",
                image_url: serverUrl+"img?img=homem1.png&time="+new Date()*1
            },{    
                content_type:"text",
                title: "Entre 18 e 30 anos",
                payload: "entre 18 e 30 anos",
                image_url: serverUrl+"img?img=homem2.png&time="+new Date()*1
            },{    
                content_type:"text",
                title: "Entre 30 e 50 anos",
                payload: "entre 30 e 50 anos",
                image_url: serverUrl+"img?img=homem4.png&time="+new Date()*1
            },{    
                content_type:"text",
                title: "Entre 50 e 70 anos",
                payload: "entre 50 e 70 anos",
                image_url: serverUrl+"img?img=homem5.png&time="+new Date()*1
            },{    
                content_type:"text",
                title: "Mais de 70 anos",
                payload: "mais que 70 anos",
                image_url: serverUrl+"img?img=homem6.png&time="+new Date()*1
            }]  
        };
        sendMessage(senderId, message);
    })
}

function askForSexOrientation(senderId){
    setStep('sexo', senderId);
    message = {
        text: 'Qual a sua orientação sexual ?',
        quick_replies:[{    
            content_type:"text",
            title: "Feminino",
            payload: "feminino",
            image_url: serverUrl+"img?img=f.png&time="+new Date()*1
        },{    
            content_type:"text",
            title: "Masculino",
            payload: "masculino",
            image_url: serverUrl+"img?img=m.png&time="+new Date()*1
        },{    
            content_type:"text",
            title: "Outros",
            payload: "outros",
            image_url: serverUrl+"img?img=g.png&time="+new Date()*1
        }]  
    };
    sendMessage(senderId, message);
}

function askForSugestion(senderId){
    setStep('sugestao', senderId);
    sendMessage(senderId, {text:'Você gostaria de deixar alguma sugestão ou comentário? Escreva a sugestão ou digite \'Não\' para pular esta etapa'});
}

function askForLocation(senderId){
    setStep('localizacao', senderId);
    sendMessage(senderId, {text: "E em que local isso aconteceu ?"});
    showTypingThenSend(senderId,true,()=>{

        message = {
            text:  'Escolha a forma que achar mais conveniente de informar o local',
            quick_replies:[{    
                content_type:"text",
                title: "Enviar localização",
                payload: "enviarLocalizacao"
            },{
                content_type:"text",
                title: "Digitar endereço",
                payload: "informarLocalizacao"
            }]  
        };
        
        sendMessage(senderId, message);
    });
}

function showSendLocation(senderId){
   
    setStep('enviarLocalizacao', senderId);

    message = {
        text: 'Por favor compartilhe sua localização',
        quick_replies:[{
            content_type:"location",
        }]
    };

    sendMessage(senderId, message);
}

function showInformLocation(senderId){
    setStep('informarLocalizacao', senderId);
    sendMessage(senderId, {text: "Por favor informe a rua ou CEP onde isso ocorreu"});
}
    
function mensagemAgradecimento(senderId){
    setStep(null, senderId);
    sendMessage(senderId, {text: "Pronto! Já salvei tudo aqui"});
    showTypingThenSend(senderId, true, ()=>{
        sendMessage(senderId, {text: "Muito obrigado pelo seu tempo! O planeta agradece"});
        message = {
            attachment: {
              type: "template",
              payload: {
                 template_type: "media",
                 elements: [
                    {
                       media_type: "image",
                       attachment_id: "1270372353065820"
                    }
                 ]
              }
            }    
          };
        sendMessage(senderId, message);
    });
    
    mysqlRepository(reclamacaoMap.get(senderId).reclamacao);
}

function yesNoQuestion(text){
    message = {
        text: text,
        quick_replies:[{    
        content_type:"text",
        title: "Sim",
        payload: "sim",
        image_url: serverUrl+"img?img=yes.png&time="+new Date()*1
    },{    
        content_type:"text",
        title: "Não",
        payload: "nao",
        image_url: serverUrl+"img?img=no.png&time="+new Date()*1
    }]};
    return message;
}

function formatDate(date){
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

// function reclamacaoReposistory(key, value){
//     if(reclamacao.get('id') == null ){
//         reclamacao.set('id', new Date()*1);
//     }
//     reclamacao.set(key,value);
//     console.log('reclamacaoRepository');
//     console.log(reclamacao);
//     return reclamacao;
// }

function reclamacaoRepository(key, value, senderId){

   if(reclamacaoMap.get(senderId) == null) {
        reclamacaoMap.set(senderId, {step: 'comeco', reclamacao: {}});
        reclamacaoMap.get(senderId).reclamacao.userId = senderId;
        reclamacaoMap.get(senderId).reclamacao.id = new Date()*1;
    }
   
   reclamacaoMap.get(senderId).reclamacao[key] = value;
   console.log('reclamacaoRepository');
   console.log(reclamacaoMap.get(senderId).reclamacao);
}

function setStep(step, senderId){
    reclamacaoMap.get(senderId).step = step;
}

function showTypingThenSend(senderId, onOff, doCallback){
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: senderId},
            sender_action:"typing_on"
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });
    if (onOff){
        setTimeout(() =>{
            doCallback(senderId);
        }, 3000);       
    }
}

function weirdRequest(senderId){
    sendMessage(senderId, {text: "Me desculpe, não consigo te entender"});
    showTypingThenSend(senderId, true, () => {
        sendMessage(senderId, {text: "Por favor, tente novamente ou digite 'Começar' para voltar ao começo"})
    });
}

var result = null;
app.get("/mysql", function(req, res){
    
    var con = getConnection();
    con.query('SELECT * from usuario', function(err, rows, fields) {
        if (!err){
            console.log('Resultado: ', rows);
            result = rows;
        }
        else
          console.log('Error while performing Query.');
    });
    con.end();
        
    console.log("result");

    while(result==null){
        console.log(result);
    }
    
    res.send(result);
    
});

app.get("/test", function(req, res){
  
   
});

function uploadViaFtp(fileName){
    config = {
        host: 'ftp.urto.com.br',
        port: 21,
        user: 'gregorio@domeuplanetacuidoeu.criaacao.art.br',
        password: process.env.DB_PASSWORD
    },
    options = {
        logging: 'basic'
    },
    client = new ftpClient(config, options);
 
    client.connect(function () {
    
        client.upload([__dirname+fileName], '/', {
            baseDir: __dirname+'/img/',
            overwrite: 'older'
        }, function (result) {
            console.log(result);
        });
    });
}

function mysqlRepository(reclamacao){
    var con = getConnection();
    var sql = 'INSERT IGNORE INTO usuario (user_id_fb, genre, age, firstname)'
                +' VALUES (?, ?, ?, ?);';
    runSqlCommand(con, sql,[reclamacao.userId,reclamacao.sexo,reclamacao.idade,reclamacao.name]) ;

    var localStr = null;
    var lat = null;
    var long = null;

    if(reclamacao.localizacao.coordinates != null){
        lat = reclamacao.localizacao.coordinates.lat;
        long = reclamacao.localizacao.coordinates.long;
    }else{
        localStr = reclamacao.localizacao;
    }
       
    var sql = 'INSERT INTO endereco (endereco, latitude, longitude)'
                +' VALUES (?, ?, ?);';
    runSqlCommand(con, sql, [localStr, lat, long]) ;

    var sql = 'INSERT INTO denuncias (id_usu, id_categoria, titulo, historia, data, anexo, localizacao, sugestao, pessoal)'
                +' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);';
    runSqlCommand(con, sql, [reclamacao.userId, 1, reclamacao.titulo,reclamacao.historia,reclamacao.data, reclamacao.fileName, 1, reclamacao.sugestao,reclamacao.pessoal]) ;
}

function runSqlCommand(con, sql, pars){
    con.query(sql, pars, 
        function (err, result) {
        if (err) throw err;
        console.log("1 record inserted");  
    });
}

function getConnection(){
    
    var con = mysql.createConnection({
        host: "criaacao.art.br",
        user: "urtoc153_greg",
        password: process.env.DB_PASSWORD,
        database: "urtoc153_domeuplanetacuidoeu"
      });
      
    con.connect(function(err) {
    if (err) throw err;
        console.log("Connected!");
    });
    return con;
}