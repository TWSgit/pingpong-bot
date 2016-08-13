/* global process, require */

var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Create chat bot
var connector = new builder.ChatConnector({
	appId:       process.env.appId || null,
	appPassword: process.env.appSecret || null
});

// Setup Restify Server
var server = restify.createServer(),
    port   = process.env.port || process.env.PORT || 3978;

server.listen(port, function () {
	console.log('%s listening to %s', server.name, server.url);
});

server.post('/api/messages', connector.listen());

server.get(/\/img\/?.*/, restify.serveStatic({
	directory: './public'
}));

server.get('/terms', restify.serveStatic({
	directory: './public',
	default:   'index.html'
}));

server.get('/privacy', restify.serveStatic({
	directory: './public',
	default:   'index.html'
}));


//=========================================================
// Bots Dialogs
//=========================================================
var chatBot       = new builder.UniversalBot(connector),
    queue         = [],
    status        = 'free',
    currentPlayer = '';

function setPP(userName, sender) {
	var queueIndex = queue.indexOf(userName),
	    name       = userName === sender ? 'You are' : `${userName} is`,
	    response   = '',
	    rest       = '',
	    nextPlayer;

	if (queueIndex !== -1) {
		response += `${name} #${queueIndex + 1} on the list already!  \n\n`;
	} else {
		queue.push(userName);
	}

	status        = 'occupied';
	currentPlayer = queue[0];

	if (currentPlayer === userName) {
		response = `${name} playing right now!`;
	} else {
		if (queue.length > 1) {
			rest = `  \nWaiting: ` + queue.slice(1).join(', ');
		}

		nextPlayer = currentPlayer === sender ? `You` : currentPlayer;

		response += `Current player: **${nextPlayer}**${rest}`;
	}

	return response;
}

function setEOP(userName, sender) {
	var queueIndex = queue.indexOf(userName),
	    name       = userName === sender ? 'You are' : `${userName} is`,
	    response   = '',
	    rest       = '',
	    nextPlayer = '';

	if (queueIndex !== -1) {
		queue.splice(queueIndex, 1);

		if (userName === currentPlayer) {
			response = `${userName} has finished the game.`
		} else {
			response = `${name} removed from the list.`
		}

	} else {
		response = `${name} not on the list!`;
	}

	if (queue.length < 1) {
		status = 'free';

		response += `\n\nNobody is playing. The table is **${status}**`;

	} else {
		currentPlayer = queue[0];

		nextPlayer = currentPlayer === sender ? `You` : currentPlayer;

		if (queue.length > 1) {
			rest = `  \nWaiting: ` + queue.slice(1).join(', ');
		}

		response += `\n\nCurrent player: **${nextPlayer}**${rest}`;
	}

	return response;
}


function getHelp(botName) {
	return `
Available commands:
---
**help**:    You are reading this :)  \n
**status**:  Displays the current occupancy.  \n
**pp [username]**:      Reserve the table / Subscribe to the wating queue.  \n
**eop [username]**:     Release the table / Unsubscribe from the wating queue.  \n

_[username] - optional, if you want to manage other users in the queue_

##### (Skype Bots are compatible since v7.26.0.101 or web client!)
`;
}

function getStatus(sender) {
	var response,
	    name = currentPlayer === sender ? 'You' : currentPlayer,
	    rest = '';

	if (status === 'free') {

		response = `Table is **free**.`;

	} else {

		if (queue.length > 1) {
			rest = `  \nWaiting: ` + queue.slice(1).join(', ');
		}

		response = `Table is **occupied**.\n\nCurrent player: **${name}**${rest}`;
	}

	return response;
}

function clearQueue(command, parameter) {
	if (process.env.codeword && parameter === process.env.codeword) {
		status = 'free';
		queue  = [];
		return `Queue is cleared.`;
	} else {
		return generalReply(command);
	}
}

function generalReply(msg) {
	return `I don't understand '${msg}'. Please use 'help' for available commands.`;
}

function getReply(message) {
	var conversation = message.address.conversation.name,
	    isGroup      = message.address.conversation.isGroup,
	    botName      = message.address.bot.name,
	    sender       = message.user.name,
	    stripBotName = new RegExp('^(?:\\s*@' + botName + '\\s+)?(\\S+)\\s*(\\S+)?', 'i'),
	    textMatch    = message.text.trim().replace(/(<([^>]+)>)/ig, '').match(stripBotName),
	    command      = textMatch && textMatch[1] && textMatch[1].trim().toLowerCase(),
	    parameter    = textMatch && textMatch[2] && textMatch[2].trim(),
	    userName     = parameter || sender,
	    reply;

	switch (command) {
		case 'pp'       :
			reply = setPP(userName, sender);
			break;
		case 'eop'      :
			reply = setEOP(userName, sender);
			break;
		case 'help'     :
			reply = getHelp(botName);
			break;
		case 's'        :
		case 'status'   :
			reply = getStatus(sender);
			break;
		case 'clear' :
			reply = clearQueue(command, parameter);
			break;
		default         :
			reply = generalReply(message.text);
	}

	return reply;
}

chatBot.dialog('/', function (session) {
	var reply = getReply(session.message);

	session.send(reply);
});

chatBot.on('conversationUpdate', function (convUpdate) {
	var address      = convUpdate.address,
	    membersAdded = convUpdate.membersAdded,
	    msg;

	if (membersAdded.length > 0) {

		msg = new builder.Message().address(address).text(`
**Welcome to the Ping-Pong chat!**

Say '**@${address.bot.name} help**' to see the available commands!

##### (Skype Bots are compatible since v7.26.0.101 or with the web client!)
`);

		chatBot.send(msg);
	}
});
