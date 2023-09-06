require('dotenv').config();
// @ts-ignore
process.env["NTBA_FIX_350"] = 1;

import TelegramBot from 'node-telegram-bot-api';
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from 'uuid';

const serviceAccount = require("./key-petal-397812-firebase-adminsdk-t4ys8-4e1d0c7433.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN || '', { polling: true });

interface Command {
    command: string;
    description: string;
}

let userStates: any = {};

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
    "REVOLUTIO 👑, 27000 CZK/10 TIKETŮ"
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

const dfMessage = `<b>Vítejte!</b>&#10;&#10; Jsem váš osobní asistent pro členství v klubu. &#10;&#10; Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b> 🤑 &#10;&#10;<b> ****************************** </b> &#10;&#10; <a href="showtip.cz"> <b> Showtip.cz </b> </a> &#10;&#10; <b> ****************************** </b> &#10;&#10;`

bot.onText(/\/start/, (msg) => {
    try {
        const chatId = msg.chat.id;
        const buttons = memberships.map((name, index) => [{ text: names[index], callback_data: `membership:${name.type}` }])
        bot.sendMessage(chatId, `${dfMessage}Vyberte si jeden z následujících <b> balíčků </b>. Existují 3 úrovně, proto vyberte ten, který Vám nejvíce vyhovuje`, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: buttons }
        });
    } catch (error) {
        bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Tady máte seznam příkazů:\n\n${commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n')}`);
});

bot.onText(/\/clenstvi( .+)?/, async (msg, match) => {
    try {
        let notKeyFound = true;
        const id: any = (match ?? [])[1];
        if (!id) {
            const chatId = msg.chat.id;
            const buttons = memberships.map((membership, index) => [{ text: names[index], callback_data: `invoice:${membership.type}` }]);
            bot.sendPhoto(chatId, "./images/membership.jpg", {
                caption: "Vyberte si členství:",
                reply_markup: { inline_keyboard: buttons }
            });
        } else {
            for (let i = 1; i <= 3; i++) {
                const doc = admin.firestore().collection('keys').doc(`${i}`);
                doc.get().then(async (doc) => {
                    if (doc.exists) {
                        const data = doc.data()!.keys;
                        if (data.includes(id)) {
                            notKeyFound = false;

                            const chatId = msg.chat.id;
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

                            await docRef.set({
                                userId: msg.chat.id,
                                userName: msg.chat.first_name + " " + msg.chat.last_name,
                                name: msg.chat.username,
                                timestamp: new Date(),
                                expiryDate: currentExpiry
                            }, { merge: true });
                            bot.sendMessage(chatId, `Máte zaplacené ${memberships[i - 1].type}. Vaše členství vyprší ${currentExpiry.toLocaleDateString()}`);
                            let groupChatId = '-1001829724709';
                            if (memberships[i - 1].type === 'All In One') {
                                groupChatId = '-1001929255559'
                            }
                            const inviteLink = await bot.exportChatInviteLink(groupChatId);
                            bot.sendMessage(msg.chat.id, `Děkujeme za platbu! Přidejte se k nám zde: ${inviteLink}, tento link vyprší za 10 minut`);
                            setTimeout(async () => {
                                await bot.exportChatInviteLink(groupChatId);
                            }, 60000);
                            return;
                        }
                    }
                });
            }
        }
        if (!notKeyFound) {
            bot.sendMessage(msg.chat.id, "Klíč je neplatný!");
        }
    } catch (e) {
        console.log(e);
        bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.onText(/\/stav/, async (msg) => {
    try {
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
    } catch (e) {
        console.log(e);
        bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.onText(/\/keygen (.+)/, async (msg, match) => {
    try {
        if (msg.chat.username !== "Broxoncz" && msg.chat.username !== "Aurelicos") return;

        const text = (match ?? [])[1];
        if (!text) {
            bot.sendMessage(msg.chat.id, "Musíte zadat číslo členství");
            return;
        }

        const chatId = parseInt(text);
        if (isNaN(chatId)) {
            bot.sendMessage(msg.chat.id, "Musíte zadat číslo členství");
            return;
        }

        const uuid = uuidv4();
        const docRef = admin.firestore().collection('keys').doc(`${chatId}`);
        const data = await docRef.get();

        if (data.exists && data.data()!.keys) {
            const keys = data.data()!.keys;
            keys.push(uuid);

            await docRef.set({
                keys: keys
            }, { merge: true });

        } else {
            await docRef.set({
                keys: [uuid]
            }, { merge: true });
        }

        bot.sendMessage(msg.chat.id, `Klíč byl úspěšně vygenerován: ${uuid}`);
    } catch (e) {
        console.log(e);
        bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.on('callback_query', async (query) => {
    const message = query.message;
    try {
        const data = query.data;
        if (data!.startsWith('membership:')) {
            const selectedType = data!.split(':')[1];
            userStates[message!.chat.id] = { type: selectedType };
            const paymentButtons = paymentNames.map(payment => [{ text: payment.name, callback_data: payment.type }]);
            bot.editMessageText(`${dfMessage}Vyberte si jednu z následujících možností:`, {
                chat_id: message!.chat.id, message_id: message!.message_id, reply_markup: { inline_keyboard: paymentButtons }, parse_mode: "HTML", disable_web_page_preview: true,
            });
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
            await bot.sendInvoice(chatId, title, description, payment.type, providerToken, currency, prices, { photo_url: "https://cdn-icons-png.flaticon.com/512/7152/7152394.png", need_name: true, need_email: true, need_phone_number: true });

            return;
        }

        if (data === 'access_code') {
            bot.sendMessage(message!.chat.id, "Zadejte kód, pomocí příkazu členství ve tvaru: /clenstvi <kód>");
        }

        if (data === 'back_to_membership') {
            const buttons = memberships.map((name, index) => [{ text: names[index], callback_data: `membership:${name.type}` }])
            bot.editMessageText(`${dfMessage}Vyberte si jeden z následujících <b> balíčků </b>. Existují 3 úrovně, proto vyberte ten, který Vám nejvíce vyhovuje`, {
                chat_id: message!.chat.id, message_id: message!.message_id, reply_markup: { inline_keyboard: buttons }, parse_mode: "HTML",
                disable_web_page_preview: true,
            });
            return;
        }
    } catch (e) {
        console.log(e);
        bot.sendMessage(message!.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true)
})

bot.on('successful_payment', async (msg) => {
    try {
        let groupChatId = '-1001829724709';
        if (msg.successful_payment?.invoice_payload === 'All In One') {
            groupChatId = '-1001929255559'
        }
        const inviteLink = await bot.exportChatInviteLink(groupChatId);
        bot.sendMessage(msg.chat.id, `Děkujeme za platbu! Přidejte se k nám zde: ${inviteLink}, tento link vyprší za 10 minut`);

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
    } catch (e) {
        console.log(e);
        bot.sendMessage(msg!.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

console.log('Bot is running...')