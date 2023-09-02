require('dotenv').config();

import { Bot, GrammyError, HttpError, InputFile } from "grammy";

interface Command {
    command: string;
    description: string;
}

interface Membership {
    type: string;
    price: number;
}

const bot = new Bot(process.env.BOT_TOKEN as string);

const commands: Command[] = [
    { command: "start", description: "Spustí bota" },
    { command: "help", description: "Vypíše příkazy" },
    { command: "clenstvi", description: "Vypíše druhy členství" },
];

const memberships: Membership[] = [
    { type: "Základní", price: 3000 },
    { type: "All In One", price: 4000 },
    { type: "Revolutio", price: 27000 }
];

const getCommandsList = (): string => {
    return commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n');
}

bot.command('start', async (ctx) => {
    await ctx.reply(`Zdravím, jsem bot, který vám pomůže s členstvím v našem klubu. \n Showtip.cz`);
});

bot.command("help", (ctx) => ctx.reply(`Tady máte seznam příkazů:\n${getCommandsList()}`));

bot.command('clenstvi', async (ctx) => {
    const buttons = memberships.map(membership => [{
        text: `${membership.type}: ${membership.price} Kč`,
        callback_data: `invoice:${membership.type}`
    }]);

    await ctx.replyWithPhoto(new InputFile("./images/membership.jpg"), {
        caption: "Vyberte si členství:",
        reply_markup: { inline_keyboard: buttons }
    });
});

bot.on('callback_query', async (ctx) => {
    const chatId = ctx.chat!.id;
    const data = ctx.callbackQuery.data;
    const providerToken = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN ?? "";

    if (!data!.startsWith('invoice:')) return;

    const selectedType = data!.split(':')[1];

    const selectedMembership = memberships.find(m => m.type === selectedType);

    if (!selectedMembership) return;

    const title = selectedMembership.type;
    const description = "Description of the membership";
    const currency = "CZK";
    const prices = [{ label: selectedMembership.type, amount: selectedMembership.price * 100 }];

    await ctx.api.sendInvoice(chatId, title, description, selectedMembership.type, providerToken, currency, prices);
});

bot.api.setMyCommands(commands);

bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("Could not contact Telegram:", e);
    } else {
        console.error("Unknown error:", e);
    }
    ctx.reply("Omlouváme se, ale nastal error :(");
});

bot.start();

console.log(`Bot is running`);