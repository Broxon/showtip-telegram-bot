require('dotenv').config();
// @ts-ignore
process.env["NTBA_FIX_350"] = 1;

import TelegramBot from 'node-telegram-bot-api';
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from 'uuid';
import { commands, memberships, names, paymentNames } from './data';

const serviceAccount = require("./key-petal-397812-firebase-adminsdk-t4ys8-4e1d0c7433.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN || '', { polling: true });

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_TOKEN || "");

let userStates: any = {};

bot.on("error", msg => console.log('[bot] error', msg))
bot.on('polling_error', msg => console.log(`[bot] polling_error:`, msg))
bot.on('webhook_error', msg => console.log(`[bot] webhook_error:`, msg))


bot.setMyCommands(commands)

const dfMessage = `<b>Vítejte!</b>&#10;&#10;Jsem váš osobní asistent pro členství v klubu. &#10;&#10;Pojďte s námi <b>vydělat</b> a získejte finanční <b>svobodu!!</b>🤑 &#10;&#10;<b>******************************</b>&#10;&#10;<a href="showtip.cz"><b>Showtip.cz</b></a>&#10;&#10;<b>******************************</b> &#10;&#10;`

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
    bot.sendMessage(chatId, `Tady máte seznam příkazů:\n\n${commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n')}\n\n\nV případě problémů kontaktujte podpora@showtip.cz nebo nás kontaktujte na Instagramu @showtip.cz`);
});

bot.onText(/\/clenstvi( .+)?/, async (msg, match) => {
    try {
        const idString: any = (match ?? [])[1];
        const chatId = msg.chat.id;

        if (!idString) {
            const buttons = memberships.map((membership, index) => [{
                text: names[index],
                callback_data: `invoice:${membership.type}`
            }]);
            bot.sendPhoto(chatId, "./images/membership.jpg", {
                caption: "Vyberte si členství:",
                reply_markup: { inline_keyboard: buttons }
            });
            return;
        }

        let keyWasFound = false;

        const id = idString.trim();

        for (let i = 1; i <= 3 && !keyWasFound; i++) {
            const doc = await admin.firestore().collection('keys').doc(`${i}`).get();

            if (doc.exists) {
                const data = doc.data()!.keys;

                if (data.includes(id)) {
                    keyWasFound = true;

                    const index = data.indexOf(id);
                    if (index > -1) {
                        data.splice(index, 1);
                    }
                    await doc.ref.update({ keys: data });

                    const docRef = admin.firestore().collection('payments').doc(`${msg.chat.id}`);
                    const user = await docRef.get();

                    let currentExpiry = new Date();
                    if (user.exists && user.data()!.expiryDate) {
                        currentExpiry = new Date(user.data()!.expiryDate.toDate());
                    }

                    if (currentExpiry < new Date()) {
                        currentExpiry = new Date();
                    }
                    currentExpiry.setMonth(currentExpiry.getMonth() + 1);

                    if (i === 2) {
                        await docRef.set({
                            userId: msg.chat.id,
                            userName: msg.chat.first_name + " " + msg.chat.last_name,
                            name: msg.chat.username,
                            timestamp: new Date(),
                            expiryDate: currentExpiry,
                            paymentId: "All In One",
                        }, { merge: true });
                    } else {
                        const collections = admin.firestore().collection("payments");
                        const snapshot = await collections.get();
                        let users = 0;
                        snapshot.forEach(async () => {
                            users++;
                        });
                        if (users > 20) {
                            return bot.sendMessage(chatId, "Již nelze kupovat tikety, pro více informací mě kontaktujte: číslo +420604274317 nebo Štěpán Pavelec na Telegramu");
                        }
                        let numberOfTickets: number = i === 1 ? 1 : 10;
                        if (user.exists && user.data()!.numberOfTickets) {
                            numberOfTickets += Number(user.data()!.numberOfTickets);
                        }
                        await docRef.set({
                            userId: msg.chat.id,
                            userName: msg.chat.first_name + " " + msg.chat.last_name,
                            name: msg.chat.username,
                            numberOfTickets: numberOfTickets,
                            timestamp: new Date(),
                        }, { merge: true });
                    }

                    bot.sendMessage(chatId, `Máte zaplacené ${memberships[i - 1].type}. Vaše členství vyprší ${currentExpiry.toLocaleDateString()}`);
                    let groupChatId = '-1001829724709';
                    if (memberships[i - 1].type === 'All In One') {
                        groupChatId = '-1001929255559'
                    }
                    const inviteLink = await bot.exportChatInviteLink(groupChatId);
                    bot.sendMessage(msg.chat.id, `Děkujeme za platbu! Přidejte se k nám zde: ${inviteLink}, tento link vyprší za 10 minut`);

                    setTimeout(async () => {
                        await bot.exportChatInviteLink(groupChatId);
                    }, 600000);
                }
            }
        }

        if (!keyWasFound) {
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

        const expiryDate = user.data()!.expiryDate ? user.data()!.expiryDate.toDate() : null;
        const now = new Date();

        if (expiryDate) {
            return bot.sendMessage(chatId, `Máte zakoupené toto členství: ${user.data()!.paymentId}, ${expiryDate < now ? "Vaše členství již vypršelo!" : `které vyprší ${expiryDate.toLocaleDateString()}`}`);
        }

        bot.sendMessage(chatId, `Něco se pokazilo, zkuste to prosím znovu`);
    } catch (e) {
        console.log(e);
        bot.sendMessage(msg.chat.id, "Něco se pokazilo, zkuste to prosím znovu");
    }
});

bot.onText(/\/keygen (.+)/, async (msg, match) => {
    try {
        if (msg.chat.username !== "Broxoncz" && msg.chat.username !== "Aurelicos" && msg.chat.username !== "prosteg") return;

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
            if (!userStates[message!.chat.id]) {
                userStates[message!.chat.id] = {};
            }
            userStates[message!.chat.id].type = selectedType;
            const paymentButtons = paymentNames.map(payment => [{ text: payment.name, callback_data: payment.type }]);
            bot.editMessageText(`${dfMessage}Vyberte si jednu z následujících možností:`, {
                chat_id: message!.chat.id, message_id: message!.message_id, reply_markup: { inline_keyboard: paymentButtons }, parse_mode: "HTML", disable_web_page_preview: true,
            });
            return;
        }

        if (data === 'credit_card' || data?.startsWith("invoice")) {
            if (data?.startsWith("invoice")) {
                const selectedType = data!.split(':')[1];
                if (!userStates[message!.chat.id]) {
                    userStates[message!.chat.id] = {};
                }
                userStates[message!.chat.id].type = selectedType;
            }
            const userState = userStates[message!.chat.id];
            if (!userState || typeof userState.type === 'undefined') {
                bot.sendMessage(message!.chat.id, "Nejprve vyberte členství");
                return;
            }
            const payment = memberships.find(m => m.type === userState.type);
            if (!payment) return;

            const chatId = message!.chat.id;
            const price_id = payment.id;
            let sessionParams: any = {
                payment_method_types: ['card'],
                metadata: {
                    telegramChatId: chatId,
                    label: payment.type,
                    userName: `${message!.chat.first_name} ${message!.chat.last_name}`,
                    userId: chatId,
                },
                line_items: [{
                    price: `${price_id}`,
                    quantity: 1,
                }],
                mode: `${payment.mode}`,
                success_url: `https://europe-west1-key-petal-397812.cloudfunctions.net/payment?session_id={CHECKOUT_SESSION_ID}`,
            };

            if (userState.coupon && userState.type === 'All In One') {
                try {
                    const stripeCoupon = await stripe.coupons.retrieve(userState.coupon);
                    if (stripeCoupon && stripeCoupon.valid) {
                        sessionParams.discounts = [{ coupon: stripeCoupon.id }];
                    } else {
                        throw new Error('Invalid coupon');
                    }
                } catch (error) {
                    console.error("Error applying coupon:", error);
                    return bot.sendMessage(chatId, "Nastala chyba při aplikaci kupónu, zkontrolujte kód kupónu.");
                }
            }

            try {
                const session = await stripe.checkout.sessions.create(sessionParams);
                await admin.firestore().collection('payments').doc(chatId.toString()).set({
                    stripeSubscriptionId: session.id,
                    status: 'active'
                });
                bot.sendMessage(chatId, `Prosím zaplaťte přes tento link: [Platba](${session.url})\nPři zaplacení souhlasíte s našimi [podmínkami](https://www.showtip.cz/obchodni-podminky).`, { parse_mode: "Markdown" });
            } catch (error) {
                console.error("Error creating Stripe session:", error);
                bot.sendMessage(chatId, "Nastala chyba při vytváření platebního linku, zkuse to prosím znovu.");
            }

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

bot.onText(/\/unsubscribe/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const doc = await admin.firestore().collection('payments').doc(chatId.toString()).get();

        if (!doc.exists || !doc.data()?.subscribeId) {
            bot.sendMessage(chatId, "Nemáte aktivní předplatné 'All in One'.");
            return;
        }

        const subscriptionId = doc.data()?.subscribeId;

        if (subscriptionId) {
            await stripe.subscriptions.cancel(subscriptionId);

            await admin.firestore().collection('payments').doc(chatId.toString()).update({
                subscribeId: null,
                status: 'cancelled'
            });

            bot.sendMessage(chatId, "Vaše předplatné 'All in One' bylo úspěšně zrušeno.");
        }
    } catch (error) {
        console.error("Chyba během odhlášení:", error);
        bot.sendMessage(chatId, "Při pokusu o odhlášení došlo k chybě. Zkuste to prosím později.");
    }
});

bot.onText(/\/apply_coupon (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const couponCode = (match ?? [])[1];

    try {
        const stripeCoupon = await stripe.coupons.retrieve(couponCode);

        if (!stripeCoupon || stripeCoupon.valid === false) {
            return bot.sendMessage(chatId, "Tento kupón není validní.");
        }

        if (!userStates[chatId]) {
            userStates[chatId] = {};
        }
        userStates[chatId].coupon = couponCode;

        return bot.sendMessage(chatId, "Kupón byl aplikován, Vaše další platba bude mít uplatněnou slevu.");
    } catch (error) {
        console.error("Error fetching coupon from Stripe:", error);
        return bot.sendMessage(chatId, "Nastala chyba při aplikaci kupónu, zkuse to prosím později.");
    }
});

bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true)
});

console.log('Bot is running...')