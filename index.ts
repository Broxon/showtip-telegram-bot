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

async function addCouponToDatabase(couponCode: string, validityDate: Date, discountAmount: number, usageLimit: number) {
    try {
        const couponRef = admin.firestore().collection('discount_coupons').doc(couponCode);

        await couponRef.set({
            validity: admin.firestore.Timestamp.fromDate(validityDate),
            discount_amount: discountAmount,
            usage_limit: usageLimit,
            used_count: 0
        });

        console.log(`Coupon with code ${couponCode} added successfully!`);
    } catch (error) {
        console.error("Error adding coupon to the database:", error);
    }
}

bot.onText(/\/addcoupon (\S+) (\d{4}-\d{2}-\d{2}) (\d+) (\d+)/, async (msg, match) => {
    // Only allow certain users (e.g., admins) to add coupons
    if (msg.chat.username !== "Broxoncz" && msg.chat.username !== "prosteg") return;

    if (!match) {
        return bot.sendMessage(msg.chat.id, "Invalid coupon details. Please try again.");
    }


    const couponCode = match[1];
    const validityDate = new Date(match[2]);
    const discountAmount = parseInt(match[3]);
    const usageLimit = parseInt(match[4]);

    await addCouponToDatabase(couponCode, validityDate, discountAmount, usageLimit);

    bot.sendMessage(msg.chat.id, `Coupon with code ${couponCode} added successfully!`);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Tady máte seznam příkazů:\n\n${commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n')}\n\n\nV případě problémů kontaktujte na tel. číslo +420604274317 nebo Štěpán Pavelec na Telegramu`);
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

        const tickets = user.data()!.numberOfTickets;
        if (tickets && user.data()!.expiryDate) {
            const expiryDate = user.data()!.expiryDate.toDate();
            const now = new Date();
            return bot.sendMessage(chatId, `Máte zakoupené toto členství: ${user.data()!.paymentId}, ${expiryDate < now ? "Vaše členství již vypršelo!" : `které vyprší ${expiryDate.toLocaleDateString()}`}\nMáte zakoupený tento počet tiketů: ${tickets}`);
        } else if (tickets) {
            return bot.sendMessage(chatId, `Máte zakoupený tento počet tiketů: ${tickets}`);
        } else if (user.data()!.expiryDate) {
            const expiryDate = user.data()!.expiryDate.toDate();
            const now = new Date();
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
            // if (userState.type === "Revolutio") {
            //     return bot.sendMessage(message!.chat.id, "Toto členství momentálně nelze zakoupit!");
            // }
            const payment = memberships.find(membership => membership.type === userState.type);
            if (!payment) return;

            if (payment === memberships[0] || payment === memberships[2]) {
                const collections = admin.firestore().collection("payments");
                const snapshot = await collections.get();
                let users = 0;
                snapshot.forEach(async () => {
                    users++;
                });
                if (users > 20) {
                    return bot.sendMessage(message!.chat.id, "Již nelze kupovat tikety, pro více informací mě kontaktujte: číslo +420604274317 nebo Štěpán Pavelec na Telegramu");
                }

            }

            let discountAmount = 1;
            if (userStates[message!.chat.id].coupon) {
                const couponRef = admin.firestore().collection('discount_coupons').doc(userStates[message!.chat.id].coupon);
                const couponData = await couponRef.get();

                console.log(couponData);

                // Fetch the current date and compare with coupon's validity
                const now = new Date();
                const couponValidity = couponData.data()!.validity.toDate();

                if (couponValidity >= now && couponData.data()!.used_count < couponData.data()!.usage_limit) {
                    // Update the used_count of the coupon
                    couponRef.update({ used_count: admin.firestore.FieldValue.increment(1) });

                    discountAmount = (100 - couponData.data()!.discount_amount) / 100; // Convert to the smallest currency unit, e.g., cents

                    // Clear the coupon from userStates after usage
                    delete userStates[message!.chat.id].coupon;
                } else {
                    // Handle invalid coupon scenario, if necessary.
                }
            }

            const chatId = message!.chat.id;
            const title = payment.type;
            const description = payment.description;
            const price_id = payment.id;
            const currency = "CZK";
            const amount = (payment.price * 100) * discountAmount;

            try {
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    metadata: {
                        telegramChatId: chatId,
                        label: payment.type,
                        userName: `${message!.chat.first_name} ${message!.chat.last_name}`,
                        userId: chatId,
                        amount: amount,
                    },
                    line_items: [{
                        price: `${price_id}`,
                        quantity: 1,
                    }],
                    mode: `${payment.mode}`,
                    success_url: `https://europe-west1-key-petal-397812.cloudfunctions.net/payment?session_id={CHECKOUT_SESSION_ID}`,
                });
                const paymentUrl = session.url;
                bot.sendMessage(chatId, `Prosím zaplaťte přes tento link: [Platba](${paymentUrl})\nPři zaplacení souhlasíte s našimi [podmínkami](https://www.showtip.cz/obchodni-podminky).`, { parse_mode: "Markdown" });
            } catch (e) {
                console.log(e)
                bot.sendMessage(chatId, "Nastal error při generování platebního linku, zkuste to prosím znovu");
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

bot.onText(/\/apply_coupon (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const couponCode = (match ?? [])[1];

    // Fetch the coupon from the database
    const couponRef = admin.firestore().collection('discount_coupons').doc(couponCode);
    const couponData = await couponRef.get();

    if (!couponData.exists) {
        return bot.sendMessage(chatId, "Invalid coupon code.");
    }

    const now = new Date();
    const couponValidity = couponData.data()!.validity.toDate();

    if (couponValidity < now) {
        return bot.sendMessage(chatId, "The coupon has expired.");
    }

    if (couponData.data()!.used_count >= couponData.data()!.usage_limit) {
        return bot.sendMessage(chatId, "The coupon has reached its usage limit.");
    }

    if (!userStates[msg.chat.id]) {
        userStates[msg.chat.id] = {};
    }
    userStates[msg.chat.id].coupon = couponCode;


    // Store the valid coupon code against the user in userStates or another appropriate data structure
    if (!userStates[msg.chat.id]) {
        userStates[msg.chat.id] = {};
    }
    userStates[msg.chat.id].coupon = couponCode;

    console.log(userStates);

    return bot.sendMessage(chatId, "Coupon applied successfully! Your next payment will reflect the discount.");
});

bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true)
})

console.log('Bot is running...')