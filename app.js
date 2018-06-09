var express = require("express");
var request = require("request");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

var name = null;

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
 app.get("/img", function(req, res){
    var img = req.query.img;
    res.sendFile("./"+img, {root: __dirname+'/categories/'});
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

    
    // fetch("https://graph.facebook.com/v2.6/" + senderId 
    //     +"?access_token="+ process.env.PAGE_ACCESS_TOKEN
    //     +"&fields=first_name" )
    // .then(res => {
    //     return res.json();
    // }).then(json =>{
    //     console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    //     console.log(json);
    //     return json.first_name;
    // }).then(txt => {
    //     name = txt;
    // });    

    // request({
    //     url: "https://graph.facebook.com/v2.6/" + senderId,
    //     qs: {
    //         access_token: process.env.PAGE_ACCESS_TOKEN,
    //         fields: "first_name"
    //     },
    //     method: "GET"
    // }, function(error, response, body) {
    //     var name = "";
    //     if (error) {
    //         console.log("Error getting user's name: " +  error);
    //     } else {
    //         var bodyObj = JSON.parse(body);
    //         console.log("name");
    //         console.log(bodyObj);
    //         name = bodyObj.first_name;      
    //         return name.first_name;                  
    //     }               
    // });
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
    
    var msg = 'Olá '+getUserName(senderId) + ', sua contribuição é muito importante para nós!';
    sendMessage(senderId, {text: msg});
  
    preparaWebView(senderId);
//    var msg = 'Ajude-nos a cuidar do planeja';
  //  sendMessage(senderId, msg);

    // message = {
    //     attachment: {
    //         type: "template",
    //         payload: {
    //             template_type: "generic",
    //             elements: [{
    //                 title: "Bem vindo",
    //                 subtitle: msg,
    //                 //image_url:"https://incrivel.club/criatividade-saude/diga-sua-idade-e-diremos-como-anda-seu-metabolismo-242910/",
    //                 buttons: [{
    //                     type: "postback",
    //                     title: "Fazer uma contribuição",
    //                     payload: "ser cidadao"
    //                 }, {
    //                     type: "postback",
    //                     title: "Não quero cuidar",
    //                     payload: "não cuidar"
    //                 }]  
    //             }]
    //         }
    //     }
    // };    

    // sendMessage(senderId ,message);
}

function digaIdade(userId){
    console.log("diga idade");
    message = {
        attachment: {
            type: "template",
            "image_aspect_ratio":"square",
            payload: {
                template_type: "generic",
                elements: [{
                    title: "Idade",
                  //  subtitle: "Por favor, qual é a sua idade?",
                    image_url:"https://raychat.herokuapp.com/img?img=desmatamento.png",
                    buttons: [{
                        type: "postback",
                        title: "Menor que 18 anos",
                        payload: "<18"
                    }]
                },
                {
                    title: "Idade",
                   // subtitle: "Por favor, qual é a sua idade?",
                    image_url:"https://raychat.herokuapp.com/img?img=lixo.png",
                    buttons: [{
                        type: "postback",
                        title: "Menor que 18 anos",
                        payload: "<18"
                    }]
                }
            
            ]
            }
        }
    };
    console.log("before send message");
    sendMessage(userId, message);
}

app.post('/sendOnWebviewClose', (req, res) => {
    let psid = req.body.psid;
    sendMessage(psid), {'text': 'Obrigado por sua reclamação'};
});

app.get('/datepicker', (req, res, next) => {
    let referer = req.get('Referer');
    console.log(referer);
    if (referer) {
        if (referer.indexOf('messenger') >= 0) {
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.messenger.com/');
        } else if (referer.indexOf('face') >= 0) {
            res.setHeader('X-Frame-Options', 'ALLOW-FROM https://www.facebook.com/');
        }
        res.sendFile('datepicker2.html', {root: __dirname});
    }
});

function preparaWebView(sender_psid) {
    message = {
        attachment: {
            type: "template",
            payload: {
                template_type: "button",
                text: "Como você gostaria de contribuir?",
                buttons: [{
                    type: "web_url",
                    url: "https://raychat.herokuapp.com/datepicker",
                    title: "Fazer reclamação",
                    webview_height_ratio: "tall",
                    messenger_extensions: true
                },{
                    type: "postback",
                    title: "Saber mais",
                    payload: "Saber mais"
                },{
                    type: "postback",
                    title: "Não contribuir",
                    payload: "Não contribuir"
                }]
            }
        }
    };

    //return response;
    sendMessage(sender_psid, message);
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