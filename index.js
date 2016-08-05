var restify = require('restify');
var builder = require('botbuilder');
var RiveScript = require('rivescript');
var riveScriptBot = new RiveScript({utf8: true});

//=========================================================
// RiveScript Setup
//=========================================================

function loading_done (batch_num) {
    console.log("Batch #" + batch_num + " has finished loading!");
    riveScriptBot.sortReplies();
}

function loading_error (error) {
    console.log("Error when loading files: " + error);
}

riveScriptBot.unicodePunctuation = new RegExp(/[.,!?;:]/g);
riveScriptBot.loadDirectory("rivescripts", loading_done, loading_error);

//=========================================================
// Bot Setup
//=========================================================

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.appId || null,
    appPassword: process.env.appSecret || null
});

var chatBot = new builder.UniversalBot(connector);

// Setup Restify Server
var server = restify.createServer(),
	port = process.env.port || process.env.PORT || 3978;

server.listen(port, function () {
   console.log('%s listening to %s', server.name, server.url);
});

server.post('/api/messages', connector.listen());

server.get(/\/img\/?.*/, restify.serveStatic({
  directory: './public'
}));

server.get('/terms', restify.serveStatic({
  directory: './public',
  default: 'index.html'
}));

server.get('/privacy', restify.serveStatic({
  directory: './public',
  default: 'index.html'
}));


//=========================================================
// Bots Dialogs
//=========================================================

chatBot.dialog('/', function (session) {
	var conversation = session.message.address.conversation.name,
		isGroup = session.message.address.conversation.isGroup,
		userName = session.message.user.name,
		botName = session.message.address.bot.name,
		messageText = session.message.text,
		reply = riveScriptBot.reply(userName, messageText);

    session.send(reply);
});
