var express = require("express");
var request = require("request");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

var name = null;
const serverUrl = "https://raychat.herokuapp.com/";
var reclamacao = new Map();
var step = null;

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
        // Iterate over each entry
        // There may be multiple entries if batched
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
    var message = event.message;
    console.log("Entering processPostback");
    console.log("Received message from senderId: " + senderId);
    console.log("Message is: " + JSON.stringify(message));

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

        // You may get a text or attachment but not both
        if (message.text) {
            var formattedMsg = message.text.toLowerCase().trim();
            var type = step == null ? formattedMsg : step;
            
            if(formattedMsg =="começar"||formattedMsg=="comecar"){
                step = null;
                mensagemDeBoasVindas(senderId);
                return;
            }

            console.log('type');
            console.log(type);
            console.log('formattedMsg');
            console.log(formattedMsg);
            console.log('message.payload');
            console.log(message.payload);
    
            //keywords that will trigger different responses
            switch (type) {
                case "comecar":
                    mensagemDeBoasVindas(senderId);
                    break;
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
                console.log('message.quick_reply.payload');
                console.log(message.quick_reply.payload);
                    if(formattedMsg =='informarlocalizacao'){
                        showInformLocation(senderId);
                    }else if(formattedMsg =='enviarlocalizacao'){
                        showSendLocation(senderId);
                    }
                    break;      
                case "informarLocalizacaoR":
                case "enviarLocalizacaoR":
                    reclamacaoRepository('localizacao', formattedMsg);
                    askForMoreInfo(senderId);
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
            weirdRequest(senderId);
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

    console.log('stt '+r.responseText);
    if (r.status === 200) {
        console.log(r.responseText);
        name = JSON.parse(r.responseText).first_name;
    }
    reclamacaoRepository('userId', senderId);    
    return name;   
}

function mensagemDeBoasVindas(senderId){
    
    var msg = 'Olá '+getUserName(senderId) + ', sua contribuição é muito importante para nós!';
    sendMessage(senderId, {text: msg});

    showTypingThenSend(senderId, true, () => {
        sendMessage(senderId, {text: "Por favor escolha entre as categorias abaixo"});
        displayCategories(senderId);    
    });

}

function displayCategories(userId){
    message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                image_aspect_ratio:"horizontal",
                elements: [{
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
                    title: "Desperdício de água",                   
                    image_url: serverUrl+"img?img=desperdicio.png&time="+new Date()*1,
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "desperdicio"
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
    sendMessage(senderId, {text: "Hummm... E que título você daria para essa reclamação?"});
}

function askForHistory(senderId){
    step = 'historia';
    sendMessage(senderId, {text: "Okay... Nos conte sua história"});
}

function askForDate(senderId){
    step = 'data';
    var daysArray = [];

    for(var i = 0; i <= 4; i++){
        var date = new Date();
        var newDate = new Date(date.setDate(date.getDate()-i));
        var dateFormatted = formatDate(newDate);
        console.log(dateFormatted);
        console.log(newDate);
        var aDay = {    
            content_type:"text",
            title: dateFormatted,
            payload: dateFormatted,
         //   image_url: serverUrl+"img?img=cal.png"
        };
        daysArray.push(aDay);  
    }

    message = {
        text: 'Humm, E quando foi que isso aconteceu ?',
        quick_replies: daysArray  
    };
    sendMessage(senderId, message);
}

function askForMidia(senderId){
    step = 'midia';
    sendMessage(senderId, {text: "Beleza... Você tem algum vídeo ou foto que evidencie o ocorrido?"});
}

function askForMoreInfo(senderId){
    step = 'pessoais';
    sendMessage(senderId, {text: "Obrigado! Já recebemos sua reclamação"});
    showTypingThenSend(senderId, true, () =>{
        message = {
            text: 'Para fins estatísticos, você gostaria de compartilhar algumas informações pessoais ?',
            quick_replies:[{    
            content_type:"text",
            title: "Sim",
            payload: "sim",
        },{    
            content_type:"text",
            title: "Não",
            payload: "nao",
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
                payload: "menor que 18 anos"
            },{    
                content_type:"text",
                title: "Entre 18 e 30 anos",
                payload: "entre 18 e 30 anos"
            },{    
                content_type:"text",
                title: "Entre 30 e 50 anos",
                payload: "entre 30 e 50 anos"
            },{    
                content_type:"text",
                title: "Entre 50 e 70 anos",
                payload: "entre 50 e 70 anos"
            },{    
                content_type:"text",
                title: "Mais de 70 anos",
                payload: "mais que 70 anos"
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
            payload: "feminino"
        },{    
            content_type:"text",
            title: "Masculino",
            payload: "masculino"
        },{    
            content_type:"text",
            title: "Outros",
            payload: "outros"
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
            text: 'Escolha a forma mais conveniente de informar o local',
            quick_replies:[{    
                content_type:"text",
                title: "Enviar localização",
                payload: "enviarLocalizacao"
            },{    
                content_type:"text",
                title: "Infomar Rua ou CEP",
                payload: "informarLocalizacao"
            }]  
        };
        sendMessage(senderId, message);
    });
}

function showSendLocation(senderId){
    step = 'enviarLocalizacao';

        message = {
            text: 'Compartilhe sua localização ?',
            quick_replies:[{    
                content_type:"location",
            }]  
        };
    
    sendMessage(senderId, message);
}

function showInformLocation(senderId){
    step = 'informarLocalizacao';

    sendMessage(senderId, {text: "Por favor informe o CEP ou a Rua"});
}

function mensagemAgradecimento(senderId){
    sendMessage(senderId, {text: "Pronto! Já salvei tudo aqui."});
    showTypingThenSend(senderId, true, ()=>{
        sendMessage(senderId, {text: "Muito obrigado pelo seu tempo! O planeta agradece."});
    });
}

function formatDate(date){
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
}

function reclamacaoRepository(key, value){
    if(reclamacao.get('id') == null ){
        reclamacao.set('id', new Date()*1);
    }
    reclamacao.set(key,value);
    console.log('reclamacaoRepository');
    console.log(reclamacao);
    return reclamacao;
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
    sendMessage(senderId, {text: "Humm... Não te entendi o que você disse..."});
    showTypingThenSend(senderId, true, () => {
        sendMessage(senderId, {text: "Por favor, tente novamente ou digite 'Começar' para voltar ao começo"})
    });
}