import { Bot } from "grammy";
require('dotenv').config();

interface ENV {
    BOT_TOKEN: string | undefined;
}

interface Command {
    command: string;
    description: string;
}

interface Membership {
    type: string;
    price: number;
    sticker: string; // URL or ID of sticker
}

const bot = new Bot(process.env.BOT_TOKEN as string);

const commands: Command[] = [
    { command: "/clenstvi", description: "Vypíše všechny druhy členství" },
    { command: "/help", description: "Show all commands" },
    { command: "hi", description: "Say hello" },
    { command: "Send a sticker", description: "Receive a thumbs up" }
];

const memberships: Membership[] = [
    { type: "Základní", price: 3000, sticker: "URL_OR_ID_OF_STICKER_1" },
    { type: "All In One", price: 4000, sticker: "URL_OR_ID_OF_STICKER_2" },
    { type: "Revolutio", price: 27000, sticker: "URL_OR_ID_OF_STICKER_3" }
];

const getCommandsList = (): string => {
    return commands.map(cmd => `${cmd.command} - ${cmd.description}`).join('\n');
}

const getMembershipsList = (): string => {
    return memberships.map(mem => `${mem.type}: ${mem.price} Kč`).join('\n');
}

bot.command("start", (ctx) => ctx.reply('Zdravím, jsem bot, který vám pomůže s členstvím v našem klubu. Napište /help pro seznam příkazů.'));
bot.command("help", (ctx) => ctx.reply(`Tady máte seznam příkazů:\n${getCommandsList()}`));
bot.command('clenstvi', (ctx) => {
    ctx.reply(getMembershipsList());
});

bot.on("message", (ctx) => ctx.reply("Got another message!"));


bot.start();
