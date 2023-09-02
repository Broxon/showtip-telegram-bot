require('dotenv').config();

import { Bot, GrammyError, HttpError, InputFile } from "grammy";
import fs from 'fs';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const inputText = ctx.message?.text || "";
    if (inputText.startsWith('/start success_')) {
        const sessionId = inputText.split('success_')[1];
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === 'paid') {
                const userId = session.metadata.telegram_user_id;
                fs.appendFileSync('paid_users.txt', `${userId}\n`);
                await ctx.reply('Děkujeme za vaši platbu!');
            } else {
                await ctx.reply('Platba neproběhla v pořádku');
            }
        } catch (error) {
            console.error('Error retrieving session:', error);
            await ctx.reply('Omlouváme se, ale nastal error :(');
        }
    } else if (inputText.startsWith('/start cancel_')) {
        const sessionId = inputText.split('cancel_')[1];
        console.log(sessionId);
        await ctx.reply('Platba byla zrušena.');

    } else {
        await ctx.reply(`Zdravím, jsem bot, který vám pomůže s členstvím v našem klubu. Napište /help pro seznam příkazů.`);
    }
});
bot.command("help", (ctx) => ctx.reply(`Tady máte seznam příkazů:\n${getCommandsList()}`));

bot.command('clenstvi', async (ctx) => {
    const buttons = await Promise.all(memberships.map(async membership => {

        const sessionConfig = {
            metadata: {
                telegram_user_id: ctx.from?.id,
            },
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'czk',
                    product_data: {
                        name: membership.type,
                    },
                    unit_amount: membership.price * 100,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel',
        };

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return [{
            text: `${membership.type}: ${membership.price} Kč`,
            url: session.url
        }];
    }));

    const keyboard = { inline_keyboard: buttons };

    await ctx.replyWithPhoto(new InputFile("./images/membership.jpg"), { reply_markup: keyboard, caption: "Vyberte si členství:" });
});


bot.on('callback_query', async (query) => {
    const membership = memberships.find(mem => mem.type === query.update.callback_query.data);
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

bot.on("message", (ctx) => {
    console.log(ctx.message);
});

bot.start();

console.log(`Bot is running`);