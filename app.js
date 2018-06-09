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
            
            console.log('type');
            console.log(type);
            //keywords that will trigger different responses
            switch (type) {
                case "idade":
                    digaIdade(senderId);
                    break;
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
            postback: 'REI'
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

    sendMessage(senderId, {text: "Por favor escolha entre as categorias abaixo"});

    displayCategories(senderId);    
}

function displayCategories(userId){
    message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                image_aspect_ratio:"square",
                elements: [{
                    title: "Corte indevido de árvores",                  
                    image_url: serverUrl+"img?img=desmatamento.png",
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "desmatamento"
                    }]
                },{
                    title: "Descarte de lixo em local inapropriado",                   
                    image_url: serverUrl+"img?img=lixo.png",
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "lixo"
                    }]
                },{
                    title: "Desperdício de água",                   
                    image_url: serverUrl+"img?img=desperdicio.png",
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "desperdicio"
                    }]
                },{
                    title: "Maltrato de animais",                   
                    image_url: serverUrl+"img?img=maltrato.png",
                    buttons: [{
                        type: "postback",
                        title: "Fazer Reclamação",
                        payload: "maltrato"
                    }]
                },{
                    title: "Queimadas",                   
                    image_url: serverUrl+"img?img=queimadas.png",
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

    var daysArray = [];

    for(int i = 1; i <= 5; i++){
        var date = new Date();
        var newDate = new Date(date.setDate(date.getDate()-i));
        var dateFormatted = formatDate(newDate);
        var aDay = {    
            content_type:"text",
            title: dateFormatted,
            payload: dateFormatted,
        };
        daysArray.push(aDay);  
    }

    message = {
        text: 'Humm, E quando foi que isso aconteceu ?',
        quick_replies: daysArray  
    };

    sendMessage(senderId, message);
}

function formatDate(date){
    var opt = {year:'numeric', month:'short', day: '2-digit'};
    var brTime = new Intl.DateTimeFormat('pt-br', opt).format;
    return brTime(date);
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

function weirdRequest(senderId){
    sendMessage(senderId, {text: "Humm... Não te entendi, o que você quiz dizer?"})
}