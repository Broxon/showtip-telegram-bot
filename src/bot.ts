require('dotenv').config();

import { Bot, GrammyError, HttpError, InputFile, InlineKeyboard } from "grammy";
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

const staticMessage = `<b>Vítejte!</b>&#10;&#10; Jsem váš osobní asistent pro členství v klubu. &#10;&#10; Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b> 🤑 &#10;&#10;<b> ****************************** </b> &#10;&#10; <a href="showtip.cz"> <b> Showtip.cz </b> </a> &#10;&#10; <b> ****************************** </b> &#10;&#10;`;

const bundles = new InlineKeyboard()
    .text("Jednotný tiket 🔥, 3000 CZK/TIKET", "signle_ticket")
    .row()
    .text("All IN ONE 🏆, 4000 CZK/MĚSÍC", "all_in_one")
    .row()
    .text("REVOLUTIO 👑, 27000 CZK/MĚSÍC", "revolutio")
    .row()

const paymentKeyboard = new InlineKeyboard()
    .text("💳 Kreditní/Debitní karta", "credit_card")
    .row()
    .text("🔑 Přístupový kód ", "access_code")
    .row()
    .text("« Zpět", "back_to_membership")
    .row();

bot.command('start', async (ctx) => {
    await ctx.reply('<b>Vítejte!</b>&#10;&#10; Jsem váš osobní asistent pro členství v klubu. &#10;&#10; Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b> 🤑 &#10;&#10;<b> ****************************** </b> &#10;&#10; <a href="showtip.cz"> <b> Showtip.cz </b> </a> &#10;&#10; <b> ****************************** </b> &#10;&#10; Vyberte si jeden z následujících <b> balíčků </b>. Existují 3 úrovně, proto vyberte ten, který Vám nejvíce vyhovuje',
        { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: bundles },);
});

bot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    let dynamicMessage; // Tato část zprávy se mění dynamicky na základě callbacku

    switch (callbackData) {
        case "signle_ticket":
        case "all_in_one":
        case "revolutio":
            dynamicMessage = "Vyberte si platební metodu:";
            await ctx.editMessageText(staticMessage + dynamicMessage, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: paymentKeyboard });
            break;
        case "back_to_membership":
            dynamicMessage = "Vyberte si jeden z následujících balíčků. Existují 3 úrovně, proto vyberte ten, který Vám nejvíce vyhovuje";
            await ctx.editMessageText(staticMessage + dynamicMessage, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: bundles });
            break;
        // Můžete přidat další případy pro další callbacky zde
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

bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.start();

console.log(`Bot is running`);