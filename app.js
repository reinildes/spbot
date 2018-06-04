var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

// Server index page
app.get("/", function (req, res) {
    res.send("Deployed!");
});
// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        console.log("Verified webhook");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        console.error("Verification failed. The tokens do not match.");
        res.sendStatus(403);
    }
});

 app.get("/datepickers", function(req, res){
     res.sendFile("./datepicker2.html", {root: __dirname});
 });

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
    // Make sure this is a page subscription
    if (req.body.object == "page") {
        // Iterate over each entry
        // There may be multiple entries if batched
        req.body.entry.forEach(function(entry) {
            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
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
    var name;
    request({
        url: "https://graph.facebook.com/v2.6/" + senderId,
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
            fields: "first_name"
        },
        method: "GET"
    }, function(error, response, body) {
        var greeting = "";
        if (error) {
            console.log("Error getting user's name: " +  error);
        } else {
            var bodyObj = JSON.parse(body);
            name = bodyObj.first_name;            
            greeting = "Oi " + name ;
        }               
    });
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

            // If we receive a text message, check to see if it matches any special
            // keywords and send back the corresponding movie detail.
            // Otherwise search for new movie.
            switch (formattedMsg) {
                case "idade":
                    digaIdade(senderId);
                    break;
                case "data":

                    const msg = setRoomPreferences(senderId);
                    console.log(msg);
                    sendMessage(senderId, msg);
                    
                default:
                    mensagemDeBoasVindas(senderId); // por enquanto
            }
        } else if (message.attachments) {
            sendMessage(senderId, {text: "Sorry, I don't understand your request."});
        }
    }
}

function sendMessage(recipientId, message) {
    console.log("before send message in");
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
    console.log("before send message end");
}

//DAQUI PARA BAIXO FUNCÕES PARA O CHATBOT DO MEU PLANETA CUIDO EU   

function mensagemDeBoasVindas(senderId){
    
    var msg = getUserName(senderId)+' Você fez uma excelente decisão hoje!';
    sendMessage(senderId, msg);
    
    var msg = 'Ajude-nos a cuidar do planeja';
    sendMessage(senderId, msg);

    message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                elements: [{
                    title: "Bem vindo",
                    subtitle: msg,
                    //image_url:"https://incrivel.club/criatividade-saude/diga-sua-idade-e-diremos-como-anda-seu-metabolismo-242910/",
                    buttons: [{
                        type: "postback",
                        title: "Fazer uma contribuição",
                        payload: "ser cidadao"
                    }, {
                        type: "postback",
                        title: "Não quero cuidar",
                        payload: "não cuidar"
                    }]  
                }]
            }
        }
    };    

    sendMessage(senderId ,message);
}

function digaIdade(userId){
    console.log("diga idade");
    message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "generic",
                elements: [{
                    title: "Idade",
                    subtitle: "Por favor, qual é a sua idade?",
                    //image_url:"https://incrivel.club/criatividade-saude/diga-sua-idade-e-diremos-como-anda-seu-metabolismo-242910/",
                    buttons: [{
                        type: "postback",
                        title: "20",
                        payload: "20 anos"
                    }, {
                        type: "postback",
                        title: "30",
                        payload: "30 anos"
                    },{
                        type: "postback",
                        title: "50",
                        payload: "vish tu ja eh terceira idade"
                    }]
                }]
            }
        }
    };
    console.log("before send message");
    sendMessage(userId, message);
}



app.get('/datepicker', (req, res, next) => {
    let referer = req.get('Referer');
    if (referer) {
        if (referer.indexOf('www.messenger.com') >= 0) {
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.messenger.com/');
        } else if (referer.indexOf('www.facebook.com') >= 0) {
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.facebook.com/');
        }
        res.sendFile('datepicker2.html', {root: __dirname});
    }
});

function setRoomPreferences(sender_psid) {
    let response = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: "OK, let's set your room preferences so I won't need to ask for them in the future.",
                buttons: [{
                    type: "web_url",
                    url: "https://raychat.herokuapp.com/datepicker",
                    title: "Set Preferences",
                    webview_height_ratio: "compact",
                    messenger_extensions: true
                }]
            }
        }
    };

    return response;
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    };
    console.log(request_body);
    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": {"access_token": process.env.VERIFICATION_TOKEN},
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}