var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.appId || null,
    appPassword: process.env.appSecret || null
});

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
var chatBot = new builder.UniversalBot(connector),
	queue = [],
	status = 'free',
	currentPlayer = '',
	nextPlayer = '';

function setPP(userName) {
	status = 'occupied';

	return `Let's play!`;
}

function setEOP(userName) {
	status = 'free';

	return `Game over.`;
}

function subscribe(userName) {
	var queueIndex = queue.indexOf(userName),
		response = '';

	if (queueIndex !== -1) {
		response = `You are #${queueIndex + 1} on the list already!  \n`;
	} else {
		queue.push(userName);
	}

	status = 'occupied';
	currentPlayer = queue[0];
	nextPlayer = queue[1];

	response += 'Current queue: ' + queue.join(', ');

	return response;
}

function unsubscribe(userName) {
	var queueIndex = queue.indexOf(userName),
		response = '';

	if (queueIndex !== -1) {
		queue.splice(queueIndex, 1);
		response = `You're removed from the list.`
	} else {
		response = `You're not on the list!`;
	}

	if (queue.length < 1) {
		status = 'free';
	} else {
		currentPlayer = queue[0];
		nextPlayer = queue[1];
	}

	return response;
}


function getHelp(botName) {
	return `
Available commands:
---
**@${botName} pp**:      Reserve the table.  
**@${botName} eop**:     Release the table.  
**@${botName} status**:  Displays the current occupancy.  
**@${botName} queue**:   Subscribe to the waiting queue
**@${botName} dequeue**: Unsubscribe from the waiting queue
**@${botName} help**:    You are reading this :)
`;
}

function getStatus() {
	var response,
		rest = '';

	if (status === 'free') {
		response = `Table is **free**.`;
	} else {
		if (queue.length > 1) {
			rest = `  \nQueue for the table: ` + queue.slice(1).join(', ');
		}

		response = `Table is **occupied**.

Current player: **${currentPlayer}**${rest}`;
	}

	return response;
}

function generalReply(botName) {
	return `Please use 'help' for available commands.`;
}

function getReply(message) {
	var conversation = message.address.conversation.name,
		isGroup = message.address.conversation.isGroup,
		userName = message.user.name,
		botName = message.address.bot.name,
		messageText = message.text,
		reply;

	switch (messageText) {
		case 'pp'       : reply = setPP(userName); break;
		case 'eop'      : reply = setEOP(userName); break;
		case 'l'        :
		case 'list'     :
		case 'q'        :
		case 'queue'    : reply = subscribe(userName); break;
		case 'u'        :
		case 'unlist'   :
		case 'deq'      :
		case 'dequeue'  : reply = unsubscribe(userName); break;
		case 'h'        :
		case 'help'     : reply = getHelp(botName); break;
		case 's'        :
		case 'status'   : reply = getStatus(); break;
		default         : reply = generalReply(botName);
	}

	return reply;
}

chatBot.dialog('/', function (session) {
	var reply = getReply(session.message);

    session.send(reply);
});

chatBot.on('conversationUpdate', function(convUpdate) {
	var address = convUpdate.address,
		membersAdded = convUpdate.membersAdded,
		msg;

		if (membersAdded.length > 0) {

			msg = new builder.Message().address(address).text(`
**Welcome to the Ping-Pong chat!**

Say '**@${address.bot.name} help**' to see the available commands!
`);

			chatBot.send(msg);
		}
});
