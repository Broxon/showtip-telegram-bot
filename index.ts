require('dotenv').config();
// @ts-ignore
process.env["NTBA_FIX_350"] = 1;

import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import * as admin from "firebase-admin";

const serviceAccount = require("./key-petal-397812-firebase-adminsdk-t4ys8-4e1d0c7433.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const port = process.env.PORT || 3000;

const app = express();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN || '', { polling: true });

interface Command {
    command: string;
    description: string;
}

let userStates: any = {};
let codes: any = {};

bot.on("error", msg => console.log('[bot] error', msg))
bot.on('polling_error', msg => console.log(`[bot] polling_error:`, msg))
bot.on('webhook_error', msg => console.log(`[bot] webhook_error:`, msg))

const commands: Command[] = [
    { command: "start", description: "Spustí bota" },
    { command: "help", description: "Vypíše příkazy" },
    { command: "clenstvi", description: "Vypíše druhy členství" },
    { command: "stav", description: "Vypíše stav členství" }
];

const memberships = [
    { type: "Základní členství", price: 3000, description: "Základní balíček pro jeden tiket" },
    { type: "All In One", price: 4000, description: "Členství na měsíc" },
    { type: "Revolutio", price: 27000, description: "Revolutio členství na měsíc" }
];

const names = [
    "JEDNOTNÝ TIKET 🔥, 3000 CZK/TIKET",
    "All IN ONE 🏆, 4000 CZK/MĚSÍC",
    "REVOLUTIO 👑, 27000 CZK/MĚSÍC"
];

const paymentNames = [
    {
        name: "💳 Kreditní/Debitní karta",
        type: "credit_card"
    },
    {
        name: "🔑 Přístupový kód ",
        type: "access_code"
    },
    {
        name: "« Zpět",
        type: "back_to_membership"
    }
]

bot.setMyCommands(commands)

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const buttons = memberships.map((name, index) => [{ text: names[index], callback_data: `membership:${name.type}` }])
    bot.sendMessage(chatId, `<b>Vítejte!</b>&#10;&#10; Jsem váš osobní asistent pro členství v klubu. &#10;&#10; Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b> 🤑 &#10;&#10;<b> ****************************** </b> &#10;&#10; <a href="showtip.cz"> <b> Showtip.cz </b> </a> &#10;&#10; <b> ****************************** </b> &#10;&#10;`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons }
    });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Tady máte seznam příkazů:\n\n${commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n')}`);
});

bot.onText(/\/clenstvi/, (msg) => {
    const chatId = msg.chat.id;
    const buttons = memberships.map(membership => [{ text: `${membership.type}: ${membership.price} Kč`, callback_data: `invoice:${membership.type}` }]);
    bot.sendPhoto(chatId, "./images/membership.jpg", {
        caption: "Vyberte si členství:",
        reply_markup: { inline_keyboard: buttons }
    });
});

bot.onText(/\/stav/, async (msg) => {
    const chatId = msg.chat.id;
    const docRef = admin.firestore().collection('payments').doc(`${chatId}`);
    let user = await docRef.get();
    if (!user.exists) {
        bot.sendMessage(chatId, `Nemáte zakoupené členství`);
        return;
    }

    const expiryDate = user.data()!.expiryDate.toDate();
    const now = new Date();
    if (expiryDate < now) {
        bot.sendMessage(chatId, `Vaše členství vypršelo`);
        return;
    }

    bot.sendMessage(chatId, `Máte zaplacené ${user.data()!.paymentId}. Vaše členství vyprší ${expiryDate.toLocaleDateString()}`);
});

bot.on('callback_query', async (query) => {
    const message = query.message;
    const data = query.data;
    if (data!.startsWith('membership:')) {
        const selectedType = data!.split(':')[1];
        userStates[message!.chat.id] = { type: selectedType };
        const paymentButtons = paymentNames.map(payment => [{ text: payment.name, callback_data: payment.type }]);
        bot.editMessageReplyMarkup({ inline_keyboard: paymentButtons }, { chat_id: message!.chat.id, message_id: message!.message_id });
        return;
    }

    if (data === 'credit_card' || data?.startsWith("invoice")) {
        if (data?.startsWith("invoice")) {
            const selectedType = data!.split(':')[1];
            userStates[message!.chat.id] = { type: selectedType };
        }
        const userState = userStates[message!.chat.id];
        const payment = memberships.find(membership => membership.type === userState.type);
        if (!payment) return;

        const chatId = message!.chat.id;
        const providerToken = process.env.PAYMENT_TOKEN ?? "";
        const title = payment.type;
        const description = payment.description;
        const currency = "CZK";
        const prices = [{ label: payment.type, amount: payment.price * 100 }];
        await bot.sendInvoice(chatId, title, description, payment.type, providerToken, currency, prices, { photo_url: "https://s3.getstickerpack.com/storage/uploads/sticker-pack/genshin-chat-stickers-v10/sticker_2.png?2aed706a22a8a4988640e3aa22311f9e&d=200x200", need_name: true });

        return;
    }

    if (data === 'back_to_membership') {
        const buttons = memberships.map((name, index) => [{ text: names[index], callback_data: `membership:${name.type}` }])
        bot.editMessageReplyMarkup({ inline_keyboard: buttons }, { chat_id: message!.chat.id, message_id: message!.message_id });
        return;
    }
});

bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true)
})

bot.on('successful_payment', async (msg) => {
    const groupChatId = '-1001829724709';
    const inviteLink = await bot.exportChatInviteLink(groupChatId);
    bot.sendMessage(msg.chat.id, `Děkujeme za platbu! Přidejte se k nám zde: ${inviteLink}, tento link vyprší za minutu`);

    const docRef = admin.firestore().collection('payments').doc(`${msg.chat.id}`);
    let user = await docRef.get();

    let currentExpiry = new Date();
    if (user.exists && user.data()!.expiryDate) {
        currentExpiry = new Date(user.data()!.expiryDate.toDate());
    }

    if (currentExpiry < new Date()) {
        currentExpiry = new Date();
    }
    currentExpiry.setMonth(currentExpiry.getMonth() + 1);

    let existingPaymentIds = [];
    if (user.data() && Array.isArray(user.data()!.paymentId)) {
        existingPaymentIds = user.data()!.paymentId;
    }

    const newPaymentId = msg.successful_payment?.invoice_payload;
    if (newPaymentId) {
        existingPaymentIds.push(newPaymentId);
    }

    await docRef.set({
        userId: msg.chat.id,
        userName: msg.chat.first_name + " " + msg.chat.last_name,
        name: msg.chat.username,
        timestamp: new Date(),
        paymentId: existingPaymentIds,
        amount: msg.successful_payment?.total_amount,
        expiryDate: currentExpiry
    }, { merge: true });

    setTimeout(async () => {
        await bot.exportChatInviteLink(groupChatId);
    }, 60000);

});

console.log('Bot is running...')