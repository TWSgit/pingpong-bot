/* global process, require */
'use strict';

const fs      = require('fs');
const restify = require('restify');
const builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Create chat bot
const connector = new builder.ChatConnector({
    appId:       process.env.appId || null,
    appPassword: process.env.appSecret || null
});

// Setup Restify Server
const server = restify.createServer();
const port   = process.env.port || process.env.PORT || 3978;

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
const chatBot = new builder.UniversalBot(connector, { persistConversationData: true });
const confirmTimeout = process.env.confirmTimeout || 60;
const STATUS_FREE = 'free';
const STATUS_OCCUPIED = 'occupied';

function readQueue(conversationData) {
    let queue = conversationData.queue || [];

    if (queue.length > 0) {
        conversationData.status = STATUS_OCCUPIED;
        conversationData.currentPlayer = queue[0];
    } else {
        conversationData.status = STATUS_FREE;
    }

    return queue;
}

function saveQueue(conversationData, queue) {
    conversationData.queue = queue;
}

function setPP(userName, sender, conversationData) {
    let queue      = readQueue(conversationData),
        queueIndex = queue.indexOf(userName),
        senderName = sender.name,
        senderId   = sender.id,
        name       = userName === senderName ? 'You are' : `${userName} is`,
        response   = '',
        rest       = '',
        nextPlayer;

    if (queueIndex !== -1) {
        response += `${name} #${queueIndex + 1} on the list already!  \n\n`;
    } else {
        queue.push(userName);
    }

    conversationData.status = STATUS_OCCUPIED;
    conversationData.currentPlayer = queue[0];

    if (conversationData.currentPlayer === userName) {
        response = `${name} playing right now!`;
    } else {
        if (queue.length > 1) {
            rest = `  \n\nWaiting: ` + queue.slice(1).join(', ');
        }

        nextPlayer = conversationData.currentPlayer === senderName ? `You` : conversationData.currentPlayer;

        response += `Current player: **${nextPlayer}**${rest}`;
    }

    saveQueue(conversationData, queue);

    return response;
}

function setEOP(userName, sender, conversationData) {
    let queue      = readQueue(conversationData),
        queueIndex = queue.indexOf(userName),
        senderName = sender.name,
        senderId   = sender.id,
        name       = userName === senderName ? 'You are' : `${userName} is`,
        response   = '',
        rest       = '',
        nextPlayer = '';

    if (queueIndex !== -1) {
        queue.splice(queueIndex, 1);

        if (userName === conversationData.currentPlayer) {
            response = `${userName} has finished the game.`
        } else {
            response = `${name} removed from the list.`
        }

    } else {
        response = `${name} not on the list!`;
    }

    if (queue.length < 1) {
        conversationData.status = STATUS_FREE;

        response += `\n\nNobody is playing. The table is **${conversationData.status}**`;

    } else {
        conversationData.currentPlayer = queue[0];

        nextPlayer = conversationData.currentPlayer === senderName ? `You` : conversationData.currentPlayer;

        if (queue.length > 1) {
            rest = `  \n\nWaiting: ` + queue.slice(1).join(', ');
        }

        response += `\n\nCurrent player: **${nextPlayer}**${rest}`;

        // TODO: confirmation flow
        //response += `\n\n**${nextPlayer}** please confirm your reservation with a **pp** again in ` + confirmTimeout + ` seconds!`;
        //conversationData.timer = setTimeout(nextPlayer, confirmTimeout * 1000);
    }

    saveQueue(conversationData, queue);

    return response;
}


function getHelp(botName) {
    return `
## Available commands:

**help**:    You are reading this :)  \n
**status**:  Displays the current occupancy.  \n
**pp [username]**:      Reserve the table / Subscribe to the waiting queue.  \n
**eop [username]**:     Release the table / Unsubscribe from the waiting queue.  \n

_[username] - optional, if you want to manage other users in the queue_

##### (Skype Bots have been compatible since v7.26.0.101 or web client!)
`;
}

function getStatus(sender, conversationData) {
    let queue = readQueue(conversationData),
        senderName = sender.name,
        name = conversationData.currentPlayer === senderName ? 'You' : conversationData.currentPlayer,
        rest = '',
        response;

    if (conversationData.status === STATUS_FREE) {

        response = `Table is **free**.`;

    } else {

        if (queue.length > 1) {
            rest = `  \n\nWaiting: ` + queue.slice(1).join(', ');
        }

        response = `Table is **occupied**.\n\nCurrent player: **${name}**${rest}`;
    }

    return response;
}

function clearQueue(command, parameter, conversationData) {
    if (process.env.codeword && parameter === process.env.codeword) {
        conversationData.status = STATUS_FREE;
        saveQueue(conversationData, []);

        return `Queue is cleared.`;
    }

    return generalReply(command);
}

function generalReply(msg) {
    return `I don't understand '${msg}'. Please use 'help' for available commands.`;
}

function nextPlayer(session) {
    clearTimeout(session.conversationData.timer);
}

function getReply(session) {
    let message          = session.message,
        conversationData = session.conversationData,
        botName          = message.address.bot.name,
        botId            = message.address.bot.id,
        sender           = message.user,
        stripBotName     = new RegExp('^(?:.*@?\\(?(?:' + botName + '|' + botId +')\\)?\\s+)?(\\S+)\\s*(.*)?', 'i'),
        textMatch        = message.text.trim().replace(/(<([^>]+)>)/ig, '').match(stripBotName),
        command          = textMatch && textMatch[1] && textMatch[1].trim().toLowerCase(),
        parameter        = textMatch && textMatch[2] && textMatch[2].trim(),
        userName         = parameter || sender.name || 'Anonymous',
        reply;

    switch (command) {
        case 'pp':
            reply = setPP(userName, sender, conversationData);
            break;
        case 'eop':
            reply = setEOP(userName, sender, conversationData);
            break;
        case 'help':
            reply = getHelp(botName);
            break;
        case 's':
        case 'status':
            reply = getStatus(sender, conversationData);
            break;
        case 'clear':
            reply = clearQueue(command, parameter, conversationData);
            break;
        default:
            reply = generalReply(message.text);
    }

    return reply;
}

chatBot.dialog('/', function (session) {
    let isGroup = session.message.address.conversation.isGroup,
        reply;

    if (isGroup) {
        reply = getReply(session);
    } else {
        reply = `Please use the group chat to communicate with me!`;
    }

    session.send(reply);
});

chatBot.on('conversationUpdate', function (convUpdate) {
    let address      = convUpdate.address,
        membersAdded = convUpdate.membersAdded,
        msg;

    if (membersAdded.length > 0) {

        msg = new builder.Message().address(address).text(`
**Welcome to the Ping-Pong chat!**

Say '**@${address.bot.name} help**' to see the available commands!

##### (Skype Bots have been compatible since v7.26.0.101 or web client!)
`);

        chatBot.send(msg);
    }
});
