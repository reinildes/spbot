var express = require("express");
var request = require("request");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

var name = null;
const serverUrl = "https://raychat.herokuapp.com/",

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

    if (payload === "Greeting") {
        // Get user's first name from the User Profile API
        // and include it in the greeting

        var greeting = 'oi '+ getUserName(senderId);
        var message = greeting + "Seja bem vindo"
        sendMessage(senderId, {text: message});
        
    } else if (payload === "Correct") {
        sendMessage(senderId, {text: "Awesome! What would you like to find out? Enter 'plot', 'date', 'runtime', 'director', 'cast' or 'rating' for the various details."});
    } else if (payload === "Incorrect") {
        sendMessage(senderId, {text: "Oops! Sorry about that. Try using the exact title of the movie"});
    }
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
    return name;   
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
            //keywords that will trigger different responses
            switch (formattedMsg) {
                case "idade":
                    digaIdade(senderId);
                    break;
                case "comeca":
                    preparaWebView(senderId);
                    break;
                default:
                    mensagemDeBoasVindas(senderId); // por enquanto
            }
        } else if (message.attachments) {
            sendMessage(senderId, {text: "Sorry, I don't understand your request."});
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