const { connect4GameObj } = require("./connect4Game");

/* eslint-disable */

const maxNumGames = 1000;
const symbols = ["⬛", "🔴", "🟡"];
const keycapEmojis = {
    "1️⃣": 0,
    "2️⃣": 1,
    "3️⃣": 2,
    "4️⃣": 3,
    "5️⃣": 4,
    "6️⃣": 5,
    "7️⃣": 6,
    "8️⃣": 7,
    "9️⃣": 8,
    "🔟": 9,
};
const surrenderEmoji = "🏳️";

const selfId = process.env.APP_ID;
const playTimeMinutes = 120;

const connect4GamesAlive = new Object();

// function createGameId() {
//     const dateObj = new Date();
//     return dateObj.getTime().toString();
// }

function c4BoardToString(C4Game) {
    let boardRepr = "";
    for (let i = 0; i < C4Game.width; i++) {
        boardRepr += Object.keys(keycapEmojis)[i] + " ";
    }
    boardRepr += "\n";
    C4Game.board.forEach((boardRow) => {
        boardRow.forEach((el) => {
            // boardRepr += el + ' '; // for plaintext
            boardRepr += symbols[el + 1] + " ";
        });
        boardRepr += "\n";
    });
    return boardRepr;
}

async function createConnect4(interaction) {
    if (!interaction.isCommand()) return;

    const newC4 = new connect4GameObj();

    // limit on number of games; delete oldest game
    if (Object.keys(connect4GamesAlive).length >= maxNumGames) {
        delete connect4GamesAlive[Object.keys(connect4GamesAlive)[0]];
    }

    const gameMsg = await interaction.reply({
        content: c4BoardToString(newC4) + "\nWaiting for player 1.",
        fetchReply: true,
    });

    connect4GamesAlive[gameMsg.id] = newC4;

    // create a collector on reacts
    const filter = () => {
        return true;
    };
    const collector = gameMsg.createReactionCollector({
        filter,
        time: playTimeMinutes * 60000,
    });

    collector.on("collect", (reaction, user) => {
        handleConnect4React(reaction, user);
    });

    // create initial reacts for game controls
    for (let i = 0; i < newC4.width; i++) {
        await gameMsg.react(Object.keys(keycapEmojis)[i]);
    }
    // create surrender react
    await gameMsg.react(surrenderEmoji);
}

async function handleConnect4React(reaction, user) {
    // ignore bot's initial reacts
    if (user.id == selfId) return;

    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
            await reaction.fetch();
        } catch (error) {
            console.error("Something went wrong when fetching the message:", error);
            // Return as `reaction.message.author` may be undefined/null
            return;
        }
    }

    const gameObj = connect4GamesAlive[reaction.message.id];

    // separate control flow for surrender move
    if (reaction.emoji.name == surrenderEmoji) {
        gameMessage = "";
        if (gameObj.players[0] == 0) {
            gameMessage = "No active players, cannot surrender.";
        } else if (user.id == gameObj.players[0]) {
            gameMessage =
                gameObj.players[1] == 0
                    ? "Game ended."
                    : `<@${gameObj.players[1]}> wins by forfeit.`;
            gameObj.gameWon = true;
        } else if (user.id == gameObj.players[1]) {
            gameMessage = `<@${gameObj.players[0]}> wins by forfeit.`;
            gameObj.gameWon = true;
        } else {
            reaction.users.remove(user.id);
            return;
        }
        reaction.message.edit({
            content: c4BoardToString(gameObj) + "\n" + gameMessage,
        });
        reaction.users.remove(user.id);
        return;
    }

    if (gameObj.players[0] == 0) {
        gameObj.players[0] = user.id;
    } else if (gameObj.players[1] == 0 && gameObj.players[0] != user.id) {
        // if (gameObj.players[0] == user.id) {
        //     reaction.message.edit({
        //         content: c4BoardToString(gameObj) + "\n" + "You cannot be both players."
        //     });
        //     reaction.users.remove(user.id);
        //     return;
        // }
        gameObj.players[1] = user.id;
    }

    let gameMessage = "";

    // game was over from before
    if (gameObj.getGameWon() || gameObj.getMovesLeft() == 0) {
        gameMessage = "Game already finished.";
    } else if (gameObj.players[gameObj.turnOf] != user.id) {
        gameMessage = "It is not your turn.";
    } else if (gameObj.insertInCol(keycapEmojis[reaction.emoji.name])) {
        // column is full
        gameMessage = "invalid move!";
    } else if (gameObj.getGameWon()) {
        // move wins the game
        gameMessage = `Game over! <@${user.id}> wins.`;
    } else if (gameObj.getMovesLeft() == 0) {
        gameMessage = "Draw!";
    } else {
        gameMessage =
            gameObj.players[1] == 0
                ? "Waiting for player 2."
                : `<@${gameObj.players[gameObj.turnOf]}>'s turn.`;
    }

    reaction.message.edit({
        content: c4BoardToString(gameObj) + "\n" + gameMessage,
    });

    reaction.users.remove(user.id);
}

module.exports = {
    createConnect4,
    handleConnect4React,
};
