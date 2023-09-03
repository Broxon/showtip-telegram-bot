require('dotenv').config();

import { Bot, Context, SessionFlavor, GrammyError, HttpError, InputFile, InlineKeyboard, session } from "grammy";

interface Command {
    command: string;
    description: string;
}

interface Membership {
    type: string;
    price: number;
    description: string;
}

interface SessionData {
    selectedMembershipType: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(process.env.BOT_TOKEN as string);
function initial(): SessionData {
    return {
        selectedMembershipType: ""
    };
}
bot.use(session({ initial }));

const commands: Command[] = [
    { command: "start", description: "Spustí bota" },
    { command: "help", description: "Vypíše příkazy" },
    { command: "clenstvi", description: "Vypíše druhy členství" },
];

const memberships: Membership[] = [
    { type: "Základní", price: 3000, description: "Základní členství" },
    { type: "All In One", price: 4000, description: "All In One členství" },
    { type: "Revolutio", price: 27000, description: "Revolutio členství" }
];

const getCommandsList = (): string => {
    return commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n');
}

const names = [
    "JEDNOTNÝ TIKET 🔥, 3000 CZK/TIKET",
    "All IN ONE 🏆, 4000 CZK/MĚSÍC",
    "REVOLUTIO 👑, 27000 CZK/MĚSÍC"
];

const getMembershipNamesKeyboard = (): InlineKeyboard => {
    return new InlineKeyboard()
        .text(names[0], `membership:${memberships[0].type}`)
        .row()
        .text(names[1], `membership:${memberships[1].type}`)
        .row()
        .text(names[2], `membership:${memberships[2].type}`)
        .row();
};

const getPaymentOptionsKeyboard = (): InlineKeyboard => {
    return new InlineKeyboard()
        .text("💳 Kreditní/Debitní karta", "credit_card")
        .row()
        .text("🔑 Přístupový kód ", "access_code")
        .row()
        .text("« Zpět", "back_to_membership")
        .row();
};

bot.command('start', async (ctx) => {
    await ctx.reply(
        `<b>Vítejte!</b>&#10;&#10; Jsem váš osobní asistent pro členství v klubu. &#10;&#10; Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b> 🤑 &#10;&#10;`,
        {
            parse_mode: "HTML",
            reply_markup: getMembershipNamesKeyboard()
        });
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
    const data = ctx.callbackQuery.data;
    if (data!.startsWith('membership:')) {
        const selectedType = data!.split(':')[1];
        ctx.session.selectedMembershipType = selectedType;
        await ctx.editMessageReplyMarkup({
            reply_markup: getPaymentOptionsKeyboard()
        });
        return;
    }

    if (data === "credit_card") {
        const selectedType = ctx.session.selectedMembershipType;
        const selectedMembership = memberships.find(m => m.type === selectedType);
        if (!selectedMembership) return;

        const chatId = ctx.chat!.id;
        const providerToken = process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN ?? "";
        const title = selectedMembership.type;
        const description = selectedMembership.description;
        const currency = "CZK";
        const prices = [{ label: selectedMembership.type, amount: selectedMembership.price * 100 }];

        await ctx.api.sendInvoice(chatId, title, description, selectedMembership.type, providerToken, currency, prices);
        return;
    }

    if (data === "back_to_membership") {
        await ctx.editMessageReplyMarkup({
            reply_markup: getMembershipNamesKeyboard()
        });
        return;
    }
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