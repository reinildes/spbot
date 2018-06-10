var express = require("express");
var request = require("request");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var bodyParser = require("body-parser");
var fs = require('fs');

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

var name = null;
const serverUrl = "https://raychat.herokuapp.com/";
var reclamacao = {};
var reclamacaoDummyDB = [];
var step = null;
const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
app.set('json spaces', 2);

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
            reclamacaoRepository('tipo', formattedMsg);
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
                    reclamacaoRepository('titulo', formattedMsg);
                    askForHistory(senderId);
                    break;
                case "historia":
                    reclamacaoRepository('historia', formattedMsg);
                    askForDate(senderId);
                    break;    
                case "data":
                    reclamacaoRepository('data', formattedMsg);
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
                    reclamacaoRepository('localizacao', formattedMsg);
                    //askForMoreInfo(senderId);
                    askForMidia(senderId);
                    break;
                case "midia":
                    //reclamacaoRepository('midia', formattedMsg);
                    //NEEDS TO FIGURE OUT HOW TO SAVE IMAGES
                    askForMoreInfo(senderId);
                    break;    
                case "pessoais":
                    reclamacaoRepository('pessoal', formattedMsg);
                    if(formattedMsg=="sim"){
                        askForAge(senderId);
                    }else{
                        mensagemAgradecimento(senderId);
                    }
                    break;  
                case "idade":
                    reclamacaoRepository('idade', formattedMsg);
                    askForSexOrientation(senderId);
                    break;
                case "sexo":
                    reclamacaoRepository('sexo', formattedMsg);
                    askForSugestion(senderId);
                    break;
                case "sugestao":
                    reclamacaoRepository('sugestao', formattedMsg);
                    mensagemAgradecimento(senderId);
                    break;
                default:
                    weirdRequest(senderId);
            }
        } else if (message.attachments) {
            var type = step;
            switch (type) {
                case "enviarLocalizacao":
                    reclamacaoRepository('localizacao', message.attachments[0].payload);
                    //askForMoreInfo(senderId);
                    askForMidia(senderId);
                    break;
                case "midia":
                    //reclamacaoRepository('midia', message.attachments[0].payload);
                    saveMedia(senderId, message.attachments[0].payload);
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

    if (name != null){
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
    reclamacaoRepository('userId', senderId);    
    return name;   
}

function mensagemDeBoasVindas(senderId){
    step = null;
    reclamacao = {};
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
    step = 'titulo';
    sendMessage(senderId, {text: "Beleza! E que título você daria para essa reclamação?"});
}

function askForHistory(senderId){
    step = 'historia';
    sendMessage(senderId, {text: "Okay.. Me conte sua história"});
}

function askForDate(senderId){
    step = 'data';
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
    step = 'midia';
    sendMessage(senderId, {text: "Beleza... Você tem algum vídeo ou foto que evidencie o ocorrido ?"});
}

function saveMedia(senderId, data){
    fs.writeFile(__dirname+'/img/'+new Date()*1+'_image.png', data, function (err) {
        if (err) throw err;
        console.log('It\'s saved!');
    });
}

function askForMoreInfo(senderId){
    step = 'pessoais';
    sendMessage(senderId, {text: "Obrigado! Já recebi aqui a sua reclamação!"});
    showTypingThenSend(senderId, true, () =>{
        message = {
            text: 'Para fins estatísticos, você gostaria de contribuir compartilhando algumas informações pessoais ?',
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
        sendMessage(senderId, message);
    });
}

function askForAge(senderId){
    step = 'idade';
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
    step = 'sexo';
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
    step = 'sugestao';
    sendMessage(senderId, {text: "Você gostaria de nos deixar alguma sugestão ?"});
}

function askForLocation(senderId){
    step = 'localizacao';
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
    step = 'enviarLocalizacao';

        message = {
            text: 'Por favor compartilhe sua localização',
            quick_replies:[{
                content_type:"location",
            }]
        };

    sendMessage(senderId, message);
}

function showInformLocation(senderId){
    step = 'informarLocalizacao';
    sendMessage(senderId, {text: "Por favor informe a rua ou CEP onde isso ocorreu"});
}
    
function mensagemAgradecimento(senderId){
    step = null;
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
    reclamacaoDummyDB.push(reclamacao);
}

function formatDate(date){
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function reclamacaoReposistory(key, value){
    if(reclamacao.get('id') == null ){
        reclamacao.set('id', new Date()*1);
    }
    reclamacao.set(key,value);
    console.log('reclamacaoRepository');
    console.log(reclamacao);
    return reclamacao;
}

function reclamacaoRepository(key, value){
   if(reclamacao.id == null) {
       reclamacao.id = new Date()*1;
   }
   reclamacao[key] = value;
   console.log('reclamacaoRepository');
   console.log(reclamacao);
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

app.get("/db", function(req, res){
    res.json(reclamacaoDummyDB);
});